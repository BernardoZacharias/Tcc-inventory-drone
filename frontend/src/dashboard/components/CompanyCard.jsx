import { Building2, ChevronRight } from "lucide-react";

export default function CompanyCard({ company, onClick }) {
  return (
    <button className="company-card" onClick={() => onClick(company)}>
      <div className="company-icon">
        <Building2 size={28} />
      </div>

      <div>
        <h3>{company.name}</h3>
        <p>{company.segment}</p>
        <span>{company.readings} leituras registradas</span>
      </div>

      <ChevronRight />
    </button>
  );
}