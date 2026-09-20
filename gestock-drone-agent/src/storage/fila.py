"""
fila.py — a leitura fica salva antes de qualquer tentativa de rede.

O PROBLEMA QUE ISTO RESOLVE, e é o problema central do projeto:

Para falar com o drone, o notebook entra na Wi-Fi dele. Essa rede não
tem internet. Então, no exato momento em que o sistema está fazendo o
trabalho para o qual existe, o banco na nuvem está inalcançável.

Mandar a leitura direto para a API significaria perdê-la. Aqui ela é
gravada em SQLite, no disco, ANTES de qualquer tentativa de envio. A
rede volta quando voltar; o inventário não depende disso.

A fila é a fonte da verdade da sessão. O envio é um detalhe posterior.
"""

from __future__ import annotations

import logging
import sqlite3
import threading
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import List, Optional

log = logging.getLogger(__name__)

ESQUEMA = """
CREATE TABLE IF NOT EXISTS leituras (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    codigo_qr    TEXT    NOT NULL,
    empresa_id   INTEGER,
    operador_id  INTEGER,
    setor_id     INTEGER,
    origem       TEXT    NOT NULL DEFAULT 'DRONE',
    status       TEXT    NOT NULL DEFAULT 'lido',
    sessao       TEXT,
    lida_em      TEXT    NOT NULL,
    enviada_em   TEXT,
    tentativas   INTEGER NOT NULL DEFAULT 0,
    ultimo_erro  TEXT
);

-- O envio procura sempre "o que ainda não foi", então este índice é o
-- que mantém a varredura barata quando a fila cresce.
CREATE INDEX IF NOT EXISTS idx_pendentes
    ON leituras (enviada_em) WHERE enviada_em IS NULL;
"""


@dataclass
class Pendente:
    id: int
    codigo_qr: str
    empresa_id: Optional[int]
    operador_id: Optional[int]
    setor_id: Optional[int]
    origem: str
    status: str
    lida_em: str
    tentativas: int

    def como_payload(self) -> dict:
        """O corpo que a API espera em POST /api/leituras."""
        return {
            "empresa_id": self.empresa_id,
            "operador_id": self.operador_id,
            "setor_id": self.setor_id,
            "codigo_qr": self.codigo_qr,
            "origem": self.origem,
            "status": self.status,
        }


def agora_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


class FilaLocal:
    """
    Fila de leituras em SQLite.

    Thread-safe por lock explícito: o laço do Agent grava, a thread de
    envio marca como enviada, e o servidor HTTP lê os contadores para a
    tela. São três threads no mesmo arquivo.
    """

    def __init__(self, caminho: Path | str, sessao: Optional[str] = None) -> None:
        self.caminho = Path(caminho)
        self.caminho.parent.mkdir(parents=True, exist_ok=True)
        self.sessao = sessao or agora_iso()

        self._lock = threading.Lock()
        # check_same_thread=False porque a conexão é compartilhada; a
        # exclusão fica por conta do lock acima, que é explícito e
        # auditável, em vez de depender do comportamento do driver.
        self._con = sqlite3.connect(str(self.caminho), check_same_thread=False)
        self._con.row_factory = sqlite3.Row

        with self._lock:
            # WAL: a thread de envio lê enquanto o laço grava, sem uma
            # travar a outra. Num leitor a 12 quadros por segundo, isso
            # é a diferença entre fluir e engasgar.
            self._con.execute("PRAGMA journal_mode=WAL")
            self._con.executescript(ESQUEMA)
            self._con.commit()

    # ── escrita ───────────────────────────────────────────────────
    def enfileirar(self, codigo_qr: str, *, empresa_id=None, operador_id=None,
                   setor_id=None, origem: str = "DRONE",
                   status: str = "lido") -> int:
        with self._lock:
            cur = self._con.execute(
                """INSERT INTO leituras
                     (codigo_qr, empresa_id, operador_id, setor_id,
                      origem, status, sessao, lida_em)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
                (codigo_qr, empresa_id, operador_id, setor_id,
                 origem, status, self.sessao, agora_iso()),
            )
            self._con.commit()
            return int(cur.lastrowid)

    def marcar_enviada(self, id_leitura: int) -> None:
        with self._lock:
            self._con.execute(
                "UPDATE leituras SET enviada_em = ?, ultimo_erro = NULL WHERE id = ?",
                (agora_iso(), id_leitura),
            )
            self._con.commit()

    def registrar_falha(self, id_leitura: int, erro: str) -> None:
        """
        Falhar não tira a leitura da fila — só anota o motivo.

        É o oposto de uma fila de mensagens comum, que descarta depois
        de N tentativas. Aqui a leitura é o produto: perder um item do
        inventário é pior que tentar mil vezes.
        """
        with self._lock:
            self._con.execute(
                """UPDATE leituras
                      SET tentativas = tentativas + 1, ultimo_erro = ?
                    WHERE id = ?""",
                (erro[:400], id_leitura),
            )
            self._con.commit()

    # ── leitura ───────────────────────────────────────────────────
    def pendentes(self, limite: int = 50) -> List[Pendente]:
        with self._lock:
            linhas = self._con.execute(
                """SELECT id, codigo_qr, empresa_id, operador_id, setor_id,
                          origem, status, lida_em, tentativas
                     FROM leituras
                    WHERE enviada_em IS NULL
                 ORDER BY id
                    LIMIT ?""",
                (limite,),
            ).fetchall()
        return [Pendente(**dict(l)) for l in linhas]

    def resumo(self) -> dict:
        with self._lock:
            linha = self._con.execute(
                """SELECT
                     COUNT(*)                                      AS total,
                     SUM(CASE WHEN enviada_em IS NULL THEN 1 ELSE 0 END) AS pendentes,
                     SUM(CASE WHEN enviada_em IS NOT NULL THEN 1 ELSE 0 END) AS enviadas
                   FROM leituras"""
            ).fetchone()
            erro = self._con.execute(
                """SELECT ultimo_erro FROM leituras
                    WHERE enviada_em IS NULL AND ultimo_erro IS NOT NULL
                 ORDER BY id DESC LIMIT 1"""
            ).fetchone()

        return {
            "total": linha["total"] or 0,
            "pendentes": linha["pendentes"] or 0,
            "enviadas": linha["enviadas"] or 0,
            "ultimo_erro": erro["ultimo_erro"] if erro else None,
        }

    def fechar(self) -> None:
        with self._lock:
            try:
                self._con.close()
            except Exception:  # noqa: BLE001
                pass
