import type { ManufacturerId } from "@/src/types/production";

export type ProductTypeId = "flag" | "beachflag" | "banner" | "bauzaunbanner" | "rollup_xbanner";
export type PrintMode = "single_sided" | "double_sided";

export type CatalogOption = {
  id: string;
  label: string;
  manufacturer: Exclude<ManufacturerId, "needs_review">;
  allowedPrintModes: PrintMode[];
};

export type ProductCatalogEntry = {
  id: ProductTypeId;
  label: string;
  materials: CatalogOption[];
  shapes?: string[];
  sizes?: Record<string, string[]>;
  defaultSizes?: string[];
  sizeMode: "preset" | "custom";
};

export const printModeLabels: Record<PrintMode, string> = {
  single_sided: "Einseitig bedruckt",
  double_sided: "Beidseitig bedruckt",
};

export const productCatalog: ProductCatalogEntry[] = [
  {
    id: "flag",
    label: "Flagge / Fahne",
    sizeMode: "custom",
    materials: [
      {
        id: "fahnenstoff-115",
        label: "Fahnenstoff 115 g/m2",
        manufacturer: "opinion",
        allowedPrintModes: ["single_sided"],
      },
      {
        id: "fahnenstoff-mesh-120",
        label: "Fahnenstoff Mesh 120 g/m2",
        manufacturer: "opinion",
        allowedPrintModes: ["single_sided"],
      },
      {
        id: "fahnenstoff-155",
        label: "Fahnenstoff 155 g/m2",
        manufacturer: "logo_pl",
        allowedPrintModes: ["single_sided"],
      },
      {
        id: "satenstoff",
        label: "Satenstoff / Satin",
        manufacturer: "logo_pl",
        allowedPrintModes: ["single_sided"],
      },
    ],
  },
  {
    id: "beachflag",
    label: "Beachflag",
    sizeMode: "preset",
    shapes: ["Tropfen", "Haiflosse", "Welle", "Square"],
    sizes: {
      Tropfen: ["S", "M", "L", "XL"],
      Haiflosse: ["S", "M", "L", "XL"],
      Welle: ["S", "M", "L", "XL"],
      Square: ["S", "M", "L", "XL"],
    },
    materials: [
      {
        id: "beachflag-fahnenstoff-115-single",
        label: "Fahnenstoff 115 g/m2",
        manufacturer: "mph_maciej",
        allowedPrintModes: ["single_sided", "double_sided"],
      },
      {
        id: "beachflag-airtex-mesh-single",
        label: "Airtex-Mesh",
        manufacturer: "mph_maciej",
        allowedPrintModes: ["single_sided"],
      },
    ],
  },
  {
    id: "banner",
    label: "Banner",
    sizeMode: "custom",
    materials: [
      { id: "pvc-banner", label: "PVC Banner", manufacturer: "opinion", allowedPrintModes: ["single_sided", "double_sided"] },
      { id: "mesh-banner", label: "Mesh Banner", manufacturer: "opinion", allowedPrintModes: ["single_sided"] },
      { id: "textilbanner", label: "Textilbanner", manufacturer: "opinion", allowedPrintModes: ["single_sided"] },
      { id: "polymesh", label: "Polymesh", manufacturer: "opinion", allowedPrintModes: ["single_sided"] },
    ],
  },
  {
    id: "bauzaunbanner",
    label: "Bauzaunbanner",
    sizeMode: "custom",
    materials: [
      { id: "bauzaun-pvc-banner", label: "PVC Banner", manufacturer: "opinion", allowedPrintModes: ["single_sided", "double_sided"] },
      { id: "bauzaun-mesh-banner", label: "Mesh Banner", manufacturer: "opinion", allowedPrintModes: ["single_sided"] },
      { id: "bauzaun-textilbanner", label: "Textilbanner", manufacturer: "opinion", allowedPrintModes: ["single_sided"] },
      { id: "bauzaun-polymesh", label: "Polymesh", manufacturer: "opinion", allowedPrintModes: ["single_sided"] },
    ],
  },
  {
    id: "rollup_xbanner",
    label: "Roll-Up / X-Banner",
    sizeMode: "custom",
    materials: [{ id: "wmd-pvc-banner", label: "PVC Banner", manufacturer: "wmd", allowedPrintModes: ["single_sided"] }],
  },
];

export function getCatalogEntry(productType: ProductTypeId) {
  return productCatalog.find((entry) => entry.id === productType) ?? productCatalog[0];
}

export function getCatalogMaterial(productType: ProductTypeId, materialId: string) {
  const entry = getCatalogEntry(productType);
  return entry.materials.find((material) => material.id === materialId) ?? entry.materials[0];
}
