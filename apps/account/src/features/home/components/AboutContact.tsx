import { identityBrand } from "@/config/brand";
import { Mail } from "lucide-react";
import { Button } from "@/components/ui/button";

export function AboutContact() {
  return (
    <section className="px-6 py-20">
      <div className="mx-auto max-w-4xl overflow-hidden rounded-3xl bg-primary/5 ring-1 ring-primary/20">
        <div className="flex flex-col items-center p-12 text-center md:p-16">
          <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Mail className="h-8 w-8" />
          </div>
          <h2 className="mb-4 text-3xl font-bold tracking-tight">与我们取得联系</h2>
          <p className="mb-8 max-w-xl text-lg text-muted-foreground">
            如果您有任何疑问、建议或是希望将您的应用接入 {identityBrand.productName} 身份中心，请随时通过邮件与我们交流。
          </p>
          <Button asChild size="lg" className="rounded-full px-8">
            <a href={`mailto:${identityBrand.supportEmail}`}>
              发送邮件至 {identityBrand.supportEmail}
            </a>
          </Button>
        </div>
      </div>
    </section>
  );
}
