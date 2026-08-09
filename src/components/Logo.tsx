import Link from "next/link";
import Image from "next/image";

export function Logo({ className = "" }: { className?: string }) {
  return (
    <Link
      href="/"
      className={`inline-flex cursor-pointer items-center gap-2 font-display text-lg font-bold tracking-tight ${className}`}
    >
      <Image
        src="/visialogo.svg"
        alt=""
        width={28}
        height={28}
        className="h-7 w-7 shrink-0 rounded-[9px]"
        priority
      />
      <span>Visia</span>
    </Link>
  );
}
