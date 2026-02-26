const line = process.argv.slice(2).join(" ");

if (!line) {
  process.exit(0);
}

const patterns = [
  /(\"phone\"\s*:\s*\")[^\"]+(\")/gi,
  /(\"email\"\s*:\s*\")[^\"]+(\")/gi,
  /(\"otp\"\s*:\s*\")[^\"]+(\")/gi,
  /(\"accessToken\"\s*:\s*\")[^\"]+(\")/gi,
  /(\"refreshToken\"\s*:\s*\")[^\"]+(\")/gi
];

let redacted = line;
for (const pattern of patterns) {
  redacted = redacted.replace(pattern, "$1***REDACTED***$2");
}

console.log(redacted);
