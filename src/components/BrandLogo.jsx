export default function BrandLogo({ className = "h-9 w-9", alt = "OneAttendance" }) {
  return (
    <img
      src={`${process.env.PUBLIC_URL}/logo.png`}
      alt={alt}
      className={`object-contain ${className}`}
    />
  );
}
