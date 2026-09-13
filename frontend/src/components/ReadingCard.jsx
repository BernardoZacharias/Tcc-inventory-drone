import { QrCode } from "lucide-react";

export default function ReadingCard({ reading }) {
  return (
    <div className="reading-card">
      <div className="reading-icon">
        <QrCode size={24} />
      </div>

      <div>
        <strong>{reading.code}</strong>
        <p>{reading.location}</p>
      </div>

      <span>{reading.status}</span>
    </div>
  );
}