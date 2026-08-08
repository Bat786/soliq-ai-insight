import { Clock, Moon, Sun } from "lucide-react";

import { timeZones, useTheme } from "@/components/soliq/ThemeProvider";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

export function AppearanceMenu() {
  const { theme, setTheme, timeZone, setTimeZone, resolvedZone, formatTime } = useTheme();

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Appearance and time zone settings">
          {theme === "dark" ? <Moon className="size-4.5" /> : <Sun className="size-4.5" />}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72">
        <p className="text-xs font-semibold tracking-wide uppercase">Appearance</p>
        <div className="mt-3 flex items-center justify-between rounded-lg border border-border bg-surface-2/50 px-3 py-2.5">
          <Label htmlFor="dark-mode" className="flex items-center gap-2 text-sm">
            {theme === "dark" ? <Moon className="size-4 text-primary" /> : <Sun className="size-4 text-warn" />}
            {theme === "dark" ? "Dark terminal" : "Light terminal"}
          </Label>
          <Switch
            id="dark-mode"
            checked={theme === "dark"}
            onCheckedChange={(v) => setTheme(v ? "dark" : "light")}
          />
        </div>

        <p className="mt-4 text-xs font-semibold tracking-wide uppercase">Time zone</p>
        <Select value={timeZone} onValueChange={setTimeZone}>
          <SelectTrigger className="mt-2 w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {timeZones.map((tz) => (
              <SelectItem key={tz.id} value={tz.id}>
                {tz.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="num mt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <Clock className="size-3" /> {formatTime(Date.now())} · {resolvedZone}
        </p>
      </PopoverContent>
    </Popover>
  );
}
