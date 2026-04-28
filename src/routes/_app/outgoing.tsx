import { createFileRoute } from "@tanstack/react-router";
import { DocumentList } from "@/components/DocumentList";

export const Route = createFileRoute("/_app/outgoing")({
  component: () => <DocumentList type="outgoing" />,
});
