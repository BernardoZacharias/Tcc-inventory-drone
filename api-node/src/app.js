const express = require("express");
const cors = require("cors");

const leituraRoutes   = require("./routes/leitura.routes");
const leitorRoutes    = require("./routes/leitor.routes");
const authRoutes      = require("./routes/auth.routes");
const empresaRoutes   = require("./routes/empresa.routes");
const operacaoRoutes  = require("./routes/operacao.routes");
const relatorioRoutes = require("./routes/relatorio.routes");
const alertaRoutes    = require("./routes/alerta.routes");
const droneRoutes     = require("./routes/drone.routes");
const statsRoutes     = require("./routes/stats.routes");
const operadorRoutes  = require("./routes/operador.routes");
const setorRoutes     = require("./routes/setor.routes");

const app = express();

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.send("API do drone funcionando");
});

app.use("/api/auth",       authRoutes);
app.use("/api/leituras",   leituraRoutes);
app.use("/api/leitura",    leitorRoutes);
app.use("/api/empresas",   empresaRoutes);
app.use("/api/operacoes",  operacaoRoutes);
app.use("/api/relatorios", relatorioRoutes);
app.use("/api/alertas",    alertaRoutes);
app.use("/api/drones",     droneRoutes);
app.use("/api/stats",      statsRoutes);
app.use("/api/operadores", operadorRoutes);
app.use("/api/setores",    setorRoutes);

module.exports = app;
