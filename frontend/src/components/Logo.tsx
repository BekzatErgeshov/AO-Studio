export default function Logo({ size = 36 }: { size?: number }) {
  return (
    <div
      style={{ width: size, height: size, fontSize: size * 0.38 }}
      className="flex shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-green-light to-green-dark font-extrabold text-white shadow-[0_4px_20px_rgba(16,185,129,0.4)]"
    >
      AO
    </div>
  )
}
