import { Twitter, Github } from "lucide-react";

const Footer = () => {
  return (
    <footer className="border-t border-foreground">
      {/* Main footer */}
      <div className="grid md:grid-cols-4 gap-8 p-6 md:p-10">
        {/* Brand */}
        <div className="md:col-span-2">
          <h3 className="text-5xl font-medium tracking-tight mb-4">ENTR</h3>
          <p className="font-mono text-xs opacity-60 max-w-xs leading-relaxed">
            The future of event ticketing. Built on blockchain for fairness, transparency, and true
            ownership.
          </p>
        </div>

        {/* Links */}
        <div>
          <h4 className="font-mono text-xs tracking-widest opacity-40 mb-4">[ LINKS ]</h4>
          <ul className="space-y-2">
            {["About", "Documentation", "Blog", "Careers"].map((link) => (
              <li key={link}>
                <a href="#" className="font-mono text-sm hover:opacity-60 transition-opacity">
                  {link}
                </a>
              </li>
            ))}
          </ul>
        </div>

        {/* Social */}
        <div>
          <h4 className="font-mono text-xs tracking-widest opacity-40 mb-4">[ CONNECT ]</h4>
          <div className="flex gap-2">
            {[Twitter, Github].map((Icon, i) => (
              <a
                key={i}
                href="#"
                className="w-10 h-10 border border-foreground flex items-center justify-center hover:bg-foreground hover:text-background transition-colors"
              >
                <Icon className="w-4 h-4" />
              </a>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="border-t border-foreground p-6 md:px-10 flex flex-col md:flex-row justify-between items-center gap-4">
        <p className="font-mono text-[10px] opacity-40">© 2025 ENTR. ALL RIGHTS RESERVED.</p>
        <div className="flex gap-8">
          <a
            href="#"
            className="font-mono text-[10px] opacity-40 hover:opacity-100 transition-opacity"
          >
            Privacy
          </a>
          <a
            href="#"
            className="font-mono text-[10px] opacity-40 hover:opacity-100 transition-opacity"
          >
            Terms
          </a>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
