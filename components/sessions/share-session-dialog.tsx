"use client";

import { Check, Copy, Mail, MessageCircle, Send, Share2 } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useI18n } from "@/i18n/client";

export function ShareSessionDialog({
  code,
  title,
  trigger,
}: {
  code: string;
  title: string;
  trigger?: React.ReactNode;
}) {
  const { t } = useI18n();
  const [copied, setCopied] = useState<"link" | "code" | null>(null);
  const [open, setOpen] = useState(false);
  const url = useMemo(() => {
    if (typeof window === "undefined") return "";
    return new URL(`/s/${encodeURIComponent(code)}`, window.location.origin).toString();
  }, [code]);
  const text = t("room.shareText", { code });
  const encodedText = encodeURIComponent(`${text}\n${url}`);

  function legacyCopy(value: string) {
    const input = document.createElement("textarea");
    input.value = value;
    input.setAttribute("readonly", "");
    input.style.position = "fixed";
    input.style.opacity = "0";
    document.body.appendChild(input);
    input.select();
    document.execCommand("copy");
    input.remove();
  }

  async function copy(value: string, kind: "link" | "code") {
    if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(value);
    else legacyCopy(value);
    setCopied(kind);
    window.setTimeout(() => setCopied(null), 1_600);
  }

  async function nativeShare() {
    if (navigator.share) await navigator.share({ title, text, url });
    else await copy(url, "link");
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? <Button variant="ghost" size="icon" aria-label={t("room.share")}><Share2 className="size-4" /></Button>}
      </DialogTrigger>
      <DialogContent className="sm:w-[min(94vw,760px)]">
        <p className="listed-eyebrow text-primary">{t("share.code")}: {code}</p>
        <DialogTitle className="mt-2 text-3xl font-semibold tracking-[-.04em]">{t("share.title")}</DialogTitle>
        <DialogDescription className="mt-2 text-sm leading-6 text-muted-foreground">{t("share.description")}</DialogDescription>
        <div className="mt-6 grid min-w-0 gap-6 md:grid-cols-[minmax(0,1fr)_13rem]">
          <div className="min-w-0 space-y-4">
            <div>
              <label className="listed-eyebrow">{t("share.link")}</label>
              <div className="mt-2 flex items-center gap-2 rounded-lg border border-border bg-background p-2 pl-3">
                <span className="min-w-0 flex-1 truncate font-mono text-xs">{url}</span>
                <Button size="sm" variant="secondary" onClick={() => void copy(url, "link")}>
                  {copied === "link" ? <Check className="size-4 text-success" /> : <Copy className="size-4" />}
                  {copied === "link" ? t("share.copied") : t("share.copyLink")}
                </Button>
              </div>
            </div>
            <div>
              <label className="listed-eyebrow">{t("share.code")}</label>
              <button type="button" onClick={() => void copy(code, "code")} className="mt-2 flex w-full items-center justify-between rounded-lg border border-border bg-background px-4 py-3">
                <span className="font-mono text-xl font-bold tracking-[.22em]">{code}</span>
                {copied === "code" ? <Check className="size-4 text-success" /> : <Copy className="size-4 text-muted-foreground" />}
              </button>
            </div>
            <div className="grid min-w-0 grid-cols-2 gap-2">
              <Button className="h-auto min-w-0 whitespace-normal py-2 leading-tight" variant="secondary" size="sm" onClick={() => void nativeShare()}><Share2 className="size-4 shrink-0" />{t("share.native")}</Button>
              <Button asChild className="h-auto min-w-0 whitespace-normal py-2 leading-tight" variant="secondary" size="sm"><a href={`https://wa.me/?text=${encodedText}`} target="_blank" rel="noreferrer"><MessageCircle className="size-4 shrink-0" />{t("share.whatsapp")}</a></Button>
              <Button asChild className="h-auto min-w-0 whitespace-normal py-2 leading-tight" variant="secondary" size="sm"><a href={`https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`} target="_blank" rel="noreferrer"><Send className="size-4 shrink-0" />{t("share.telegram")}</a></Button>
              <Button asChild className="h-auto min-w-0 whitespace-normal py-2 leading-tight" variant="secondary" size="sm"><a href={`mailto:?subject=${encodeURIComponent(title)}&body=${encodedText}`}><Mail className="size-4 shrink-0" />{t("share.email")}</a></Button>
            </div>
          </div>
          <div className="flex min-w-0 flex-col items-center rounded-xl border border-border bg-white p-4 text-center text-black">
            {url ? <QRCodeSVG value={url} size={168} marginSize={1} level="M" aria-label={t("share.qr")} /> : <div className="size-[168px]" />}
            <p className="mt-3 text-xs font-semibold">{t("share.qrHelp")}</p>
          </div>
        </div>
        <p className="mt-5 rounded-lg border border-warning/25 bg-warning/10 px-4 py-3 text-xs leading-5 text-muted-foreground">{t("share.safety")}</p>
      </DialogContent>
    </Dialog>
  );
}
