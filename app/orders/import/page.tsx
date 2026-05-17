import { AngebotImportWorkspace } from "@/src/components/orders/angebot-import-workspace";
import { createOrderFromAngebot, parseAngebotPdf } from "./actions";

export default function AngebotImportPage() {
  return <AngebotImportWorkspace onParsePdf={parseAngebotPdf} onCreateOrder={createOrderFromAngebot} />;
}

