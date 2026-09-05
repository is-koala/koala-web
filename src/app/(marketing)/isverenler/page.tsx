import { MarketingPage } from "@/components/marketing-page";
import { marketingContent } from "@/content/marketing";
import { pageMetadata } from "@/lib/metadata";

const content = marketingContent.isverenler;
export const metadata = pageMetadata(content.title, content.description, "/isverenler");

export default function Page() {
  return <MarketingPage content={content} />;
}
