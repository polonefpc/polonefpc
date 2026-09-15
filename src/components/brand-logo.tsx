import logoAsset from "@/assets/polone-logo.png.asset.json";

type BrandLogoProps = {
  className?: string;
  showName?: boolean;
  nameClassName?: string;
};

export function BrandLogo({ className = "h-9 w-9", showName = true, nameClassName = "font-extrabold" }: BrandLogoProps) {
  return (
    <span className="inline-flex items-center gap-2 shrink-0" translate="no">
      <img
        src={logoAsset.url}
        alt="شعار Polone"
        className={`${className} rounded-lg bg-primary-foreground object-contain p-0.5`}
      />
      {showName && <span className={nameClassName}>polone</span>}
    </span>
  );
}