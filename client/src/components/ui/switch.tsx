import * as React from "react"
import { Switch as HeadlessSwitch } from "@headlessui/react"
import { clsx } from "clsx"

type SwitchProps = {
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  className?: string
}

export function Switch({ checked, onCheckedChange, className }: SwitchProps) {
  return (
    <HeadlessSwitch
      checked={checked}
      onChange={onCheckedChange}
      className={clsx(
        "relative inline-flex h-[24px] w-[44px] shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2",
        checked ? "bg-green-600" : "bg-gray-200",
        className
      )}
    >
      <span
        className={clsx(
          "pointer-events-none inline-block h-[20px] w-[20px] transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out",
          checked ? "translate-x-5" : "translate-x-0"
        )}
      />
    </HeadlessSwitch>
  )
}
