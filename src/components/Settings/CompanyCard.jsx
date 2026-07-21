import React from "react";
import { FaEdit, FaTrash, FaBuilding } from "react-icons/fa";
import { getMediaUrl } from "../../utils/api";

function CompanyCard({ company, isActive, onSwitch, onEdit, onDelete, canManageCompany = true }) {
  return (
    <div
      className={`flex justify-between items-center p-4 border rounded-lg transition-all duration-200
      ${isActive ? "border-indigo-500 bg-indigo-50 shadow-sm" : "border-gray-200 hover:bg-gray-50"}`}
    >
      <div className="flex items-center gap-4 flex-1">
        {company.logo_url ? (
          <img 
            src={getMediaUrl(company.logo_url)} 
            alt="Company Logo" 
            className="w-10 h-10 rounded-lg object-cover border border-gray-200 shadow-sm bg-white shrink-0"
            onError={(e) => {
              e.target.onerror = null; 
              e.target.style.display = 'none';
              e.target.nextSibling.style.display = 'flex';
            }}
          />
        ) : null}
        <div className={`w-10 h-10 rounded-lg bg-indigo-100 items-center justify-center border border-indigo-200 shadow-sm shrink-0 ${company.logo_url ? 'hidden' : 'flex'}`}>
          <FaBuilding className="text-indigo-500 text-lg" />
        </div>
        <div className="flex-col">
        <div className="flex items-center gap-2">
          <p className="font-medium text-gray-900">{company.name || "No name found"}</p>
          {company.role && (
            <span className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded capitalize">
              {company.role.replace(/_/g, ' ')}
            </span>
          )}
          {isActive && (
            <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-medium">
              Active
            </span>
          )}
        </div>
        <p className="text-sm text-gray-500 mt-0.5">{company.legal_name || "No legal name"}</p>
        {(company.city || company.state) && (
          <p className="text-xs text-gray-400 mt-1">
            {[company.city, company.state].filter(Boolean).join(", ")}
          </p>
        )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={() => onSwitch(company)}
          className="text-sm bg-gray-100 px-3 py-1.5 rounded-lg hover:bg-gray-200 transition-colors font-medium text-gray-700"
        >
          Switch
        </button>

        {canManageCompany && (
          <>
            <button
              onClick={() => onEdit(company)}
              className="p-2 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
              title="Edit Company"
            >
              <FaEdit className="w-4 h-4" />
            </button>

            <button
              onClick={() => onDelete(company)}
              className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
              title="Delete Company"
            >
              <FaTrash className="w-4 h-4" />
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default CompanyCard;
