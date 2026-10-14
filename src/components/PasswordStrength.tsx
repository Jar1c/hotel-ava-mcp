import { useMemo } from "react"

type Strength = "weak" | "medium" | "strong"

interface PasswordStrengthProps {
  password: string
}

export default function PasswordStrength({ password }: PasswordStrengthProps) {
  const strength = useMemo((): Strength => {
    if (!password) return "weak"

    let score = 0
    if (password.length >= 8) score++
    if (/[A-Z]/.test(password)) score++
    if (/[0-9]/.test(password)) score++

    if (score <= 1) return "weak"
    if (score <= 2) return "medium"
    return "strong"
  }, [password])

  if (!password) return null

  const getColor = (s: Strength) => {
    switch (s) {
      case "weak": return "#A4423A"
      case "medium": return "#FBBC05"
      case "strong": return "#3D6B4F"
    }
  }

  const labels = {
    weak: "Weak",
    medium: "Medium",
    strong: "Strong"
  }

  const requirements = [
    { label: "At least 8 characters", met: password.length >= 8 },
    { label: "Contains uppercase letter", met: /[A-Z]/.test(password) },
    { label: "Contains number", met: /[0-9]/.test(password) },
  ]

  return (
    <div className="mt-1.5">
      <div className="flex items-center gap-1.5">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="flex-1 h-1 rounded-full transition-colors duration-200"
            style={{ backgroundColor: i < (strength === "weak" ? 0 : strength === "medium" ? 1 : 3) ? getColor(strength) : "#E5E1DA" }}
          />
        ))}
      </div>
      <p className="text-[11px] font-medium mt-1" style={{ color: getColor(strength) }}>
        Password strength: {labels[strength]}
      </p>
      <ul className="text-[11px] mt-1 space-y-0.5">
        {requirements.map((req) => (
          <li key={req.label} style={{ color: req.met ? "#3D6B4F" : "#9A9A90" }}>
            {req.met ? "✓" : "•"} {req.label}
          </li>
        ))}
      </ul>
    </div>
  )
}