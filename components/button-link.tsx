import Link from "next/link";
import { type ComponentProps } from "react";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import type { VariantProps } from "class-variance-authority";

type Props = ComponentProps<typeof Link> & VariantProps<typeof buttonVariants>;

export function ButtonLink({ className, variant, size, ...props }: Props) {
  return <Link className={cn(buttonVariants({ variant, size, className }))} {...props} />;
}
