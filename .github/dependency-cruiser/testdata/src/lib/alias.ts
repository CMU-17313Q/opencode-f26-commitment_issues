import { Self } from "@/lib/self-namespace"
import { a } from "@/cycle/a"
import { X } from "@/lib/type-x"
export const used = [Self, a] as unknown as X
