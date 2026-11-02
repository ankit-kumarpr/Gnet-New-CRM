import { createContext, useContext, useEffect, useState } from "react";
import api from "../services/api";

const DEFAULT_BRAND = "GrandeurNet";

const BrandContext = createContext({
  brand: { companyName: DEFAULT_BRAND, logoUrl: "" },
  refreshBrand: async () => {},
});

export function BrandProvider({ children }) {
  const [brand, setBrand] = useState({ companyName: DEFAULT_BRAND, logoUrl: "" });

  const refreshBrand = async () => {
    const res = await api.get("/settings/brand");
    const name = String(res.data.data?.companyName || "").trim();
    setBrand({
      companyName: !name || /^ak\s*techs?$/i.test(name) ? DEFAULT_BRAND : name,
      logoUrl: res.data.data?.logoUrl || "",
    });
  };

  useEffect(() => {
    refreshBrand().catch(() => {});
  }, []);

  return (
    <BrandContext.Provider value={{ brand, refreshBrand }}>
      {children}
    </BrandContext.Provider>
  );
}

export const useBrand = () => useContext(BrandContext);
