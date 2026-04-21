import { SlidersHorizontal } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger
} from "@/components/ui/sheet";
import type { PosterFilterState } from "@/features/discover/event-posters";
import { cn } from "@/lib/utils";

interface DiscoverFilterSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: string[];
  moods: string[];
  filters: PosterFilterState;
  onCategoryChange: (value: string) => void;
  onMoodChange: (value: string) => void;
  onVerifiedToggle: () => void;
  onBudgetToggle: () => void;
  onReset: () => void;
}

const pillClassName =
  "justify-start rounded-full border border-white/10 bg-white/[0.03] px-3 py-2 font-mono text-[10px] uppercase tracking-[0.18em] text-white/72 hover:bg-white/[0.08]";

const DiscoverFilterSheet = ({
  open,
  onOpenChange,
  categories,
  moods,
  filters,
  onCategoryChange,
  onMoodChange,
  onVerifiedToggle,
  onBudgetToggle,
  onReset
}: DiscoverFilterSheetProps) => {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetTrigger asChild>
        <button
          type="button"
          className="inline-flex h-12 w-12 items-center justify-center border border-white/10 bg-white/[0.03] text-white transition-colors hover:bg-white/[0.08]"
          aria-label="Mở bộ lọc khám phá"
        >
          <SlidersHorizontal className="h-4 w-4" />
        </button>
      </SheetTrigger>
      <SheetContent side="bottom" className="h-[88vh] border-white/10 bg-[#090a0d] px-0 text-white">
        <SheetHeader className="border-b border-white/10 px-5 pb-4 pt-6 text-left">
          <SheetTitle className="text-left text-xl tracking-tight text-white">Bộ lọc</SheetTitle>
          <SheetDescription className="text-left text-sm text-white/58">
            Giữ discover giàu hình ảnh, còn các filter sâu nằm gọn trong sheet.
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-6 overflow-y-auto px-5 py-5">
          <section>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-mono text-[10px] uppercase tracking-[0.24em] text-white/45">
                Category
              </h3>
              <Badge
                variant="outline"
                className="rounded-full border-white/10 bg-white/[0.03] text-white/60"
              >
                {filters.category}
              </Badge>
            </div>
            <div className="flex flex-wrap gap-2">
              {categories.map((category) => (
                <Button
                  key={category}
                  type="button"
                  variant="ghost"
                  className={cn(
                    pillClassName,
                    filters.category === category && "border-white/20 bg-white text-black"
                  )}
                  onClick={() => onCategoryChange(category)}
                >
                  {category}
                </Button>
              ))}
            </div>
          </section>

          <section>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-mono text-[10px] uppercase tracking-[0.24em] text-white/45">
                Mood
              </h3>
              <Badge
                variant="outline"
                className="rounded-full border-white/10 bg-white/[0.03] text-white/60"
              >
                {filters.mood}
              </Badge>
            </div>
            <div className="flex flex-wrap gap-2">
              {moods.map((mood) => (
                <Button
                  key={mood}
                  type="button"
                  variant="ghost"
                  className={cn(
                    pillClassName,
                    filters.mood === mood && "border-white/20 bg-white text-black"
                  )}
                  onClick={() => onMoodChange(mood)}
                >
                  {mood}
                </Button>
              ))}
            </div>
          </section>

          <section className="space-y-3">
            <h3 className="font-mono text-[10px] uppercase tracking-[0.24em] text-white/45">
              Trust toggles
            </h3>
            <button
              type="button"
              onClick={onVerifiedToggle}
              className={cn(
                "flex w-full items-center justify-between border px-4 py-4 text-left transition-colors",
                filters.verifiedOnly
                  ? "border-white/20 bg-white text-black"
                  : "border-white/10 bg-white/[0.03] text-white"
              )}
            >
              <span>
                <span className="block font-medium tracking-tight">Chỉ hiện verified</span>
                <span className="mt-1 block text-xs opacity-70">
                  Ưu tiên những event có trust signal rõ ràng.
                </span>
              </span>
              <span className="font-mono text-[10px] uppercase tracking-[0.2em]">
                {filters.verifiedOnly ? "On" : "Off"}
              </span>
            </button>
            <button
              type="button"
              onClick={onBudgetToggle}
              className={cn(
                "flex w-full items-center justify-between border px-4 py-4 text-left transition-colors",
                filters.budgetOnly
                  ? "border-white/20 bg-white text-black"
                  : "border-white/10 bg-white/[0.03] text-white"
              )}
            >
              <span>
                <span className="block font-medium tracking-tight">Dưới 1 triệu</span>
                <span className="mt-1 block text-xs opacity-70">
                  Dành cho phiên browse nhanh theo budget.
                </span>
              </span>
              <span className="font-mono text-[10px] uppercase tracking-[0.2em]">
                {filters.budgetOnly ? "On" : "Off"}
              </span>
            </button>
          </section>
        </div>

        <div className="flex items-center justify-between border-t border-white/10 px-5 py-4">
          <Button
            type="button"
            variant="ghost"
            className="rounded-full border border-white/10 bg-white/[0.03] px-4 font-mono text-[10px] uppercase tracking-[0.18em] text-white hover:bg-white/[0.08]"
            onClick={onReset}
          >
            Reset
          </Button>
          <Button
            type="button"
            className="rounded-full bg-white px-5 font-mono text-[10px] uppercase tracking-[0.18em] text-black hover:bg-white/88"
            onClick={() => onOpenChange(false)}
          >
            Áp dụng
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default DiscoverFilterSheet;
