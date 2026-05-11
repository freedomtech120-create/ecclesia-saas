import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Church, Shield, Users, BarChart3, Globe, Zap, Smartphone, CheckCircle2 } from 'lucide-react';
import { motion } from 'motion/react';

export default function LandingPage() {
  return (
    <div className="flex flex-col min-h-screen bg-white font-sans selection:bg-indigo-100 selection:text-indigo-900 overflow-x-hidden">
      {/* Navbar */}
      <nav className="h-20 border-b border-slate-100 flex items-center justify-between px-6 md:px-12 max-w-7xl mx-auto w-full sticky top-0 bg-white/80 backdrop-blur-md z-50">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 bg-indigo-600 rounded-xl flex items-center justify-center text-white font-bold shadow-lg shadow-indigo-100">
            <Church className="w-5 h-5" />
          </div>
          <span className="font-black text-xl tracking-tighter text-slate-900">ECCLESIA</span>
        </div>
        <div className="hidden md:flex items-center gap-8">
          <a href="#features" className="text-sm font-bold text-slate-500 hover:text-indigo-600 transition-colors">Features</a>
          <a href="#about" className="text-sm font-bold text-slate-500 hover:text-indigo-600 transition-colors">About</a>
          <Link to="/login" className="text-sm font-bold text-slate-900 hover:text-indigo-600 transition-colors">Login</Link>
          <Link to="/login" className="px-6 py-2.5 bg-indigo-600 text-white rounded-full text-sm font-black shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all hover:-translate-y-0.5 active:scale-95">
            GET STARTED
          </Link>
        </div>
        {/* Mobile Menu Button - Simplified */}
        <Link to="/login" className="md:hidden px-4 py-2 bg-indigo-600 text-white rounded-full text-xs font-black shadow-lg shadow-indigo-100">
          LOGIN
        </Link>
      </nav>
      
      <main className="flex-1">
        {/* Hero Section */}
        <section className="relative pt-20 pb-32 overflow-hidden">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-6xl h-full -z-10 opacity-20 pointer-events-none">
            <div className="absolute top-0 left-0 w-[500px] h-[500px] bg-indigo-300 rounded-full blur-[120px] animate-pulse"></div>
            <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-sky-200 rounded-full blur-[120px] animate-pulse delay-700"></div>
          </div>

          <div className="max-w-7xl mx-auto px-6 text-center space-y-8">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="inline-flex items-center gap-2 px-4 py-1.5 bg-indigo-50 text-indigo-700 rounded-full text-[10px] md:text-xs font-black uppercase tracking-widest border border-indigo-100"
            >
              <Smartphone className="w-3.5 h-3.5" />
              Android App Now Available
            </motion.div>
            
            <motion.h1 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="text-5xl md:text-8xl font-black tracking-tighter text-slate-900 leading-[0.95]"
            >
              Manage your Ministry <br />
              <span className="text-indigo-600 italic">without limits.</span>
            </motion.h1>
            
            <motion.p 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="text-lg md:text-2xl text-slate-500 max-w-3xl mx-auto leading-relaxed font-medium"
            >
              The most advanced cloud platform for multi-branch churches. 
              Built for growth, designed for excellence.
            </motion.p>
            
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="flex flex-col sm:flex-row gap-4 justify-center pt-4"
            >
              <Link to="/login" className="px-10 py-5 bg-indigo-600 text-white rounded-2xl text-lg font-black shadow-2xl shadow-indigo-200 hover:bg-indigo-700 transition-all hover:scale-105 active:scale-95 group">
                START FREE TRIAL
                < Zap className="w-5 h-5 ml-2 inline-block group-hover:scale-125 transition-transform" />
              </Link>
              <Button variant="outline" className="px-10 py-5 h-auto border-2 border-slate-100 text-slate-600 rounded-2xl text-lg font-black hover:bg-slate-50 transition-all">
                BOOK A DEMO
              </Button>
            </motion.div>

            {/* Dashboard Mockup - Simplified */}
            <motion.div 
               initial={{ opacity: 0, scale: 0.95 }}
               animate={{ opacity: 1, scale: 1 }}
               transition={{ delay: 0.5, duration: 0.8 }}
               className="mt-20 relative max-w-5xl mx-auto rounded-3xl border-8 border-slate-100 shadow-2xl overflow-hidden aspect-video bg-slate-900"
            >
               <div className="absolute inset-0 bg-gradient-to-br from-indigo-900/20 to-transparent"></div>
               <div className="p-8 h-full flex flex-col">
                  <div className="flex items-center justify-between mb-8">
                     <div className="flex gap-2">
                        <div className="w-3 h-3 rounded-full bg-red-400"></div>
                        <div className="w-3 h-3 rounded-full bg-amber-400"></div>
                        <div className="w-3 h-3 rounded-full bg-emerald-400"></div>
                     </div>
                  </div>
                  <div className="grid grid-cols-3 gap-6 flex-1">
                     <div className="col-span-2 rounded-xl bg-white/5 border border-white/10 p-6 flex flex-col justify-end">
                        <div className="h-32 w-full bg-gradient-to-t from-indigo-500/20 to-transparent rounded-t-lg"></div>
                        <div className="mt-4 text-left">
                           <div className="text-white font-bold text-xl">Revenue Growth</div>
                           <div className="text-white/40 text-sm italic">+24% this month</div>
                        </div>
                     </div>
                     <div className="rounded-xl bg-white/5 border border-white/10 p-6 flex flex-col gap-4">
                        {[1, 2, 3].map(i => (
                           <div key={i} className="h-12 w-full bg-white/5 rounded-lg flex items-center px-4 gap-3">
                              <div className="w-6 h-6 rounded-full bg-indigo-500/40"></div>
                              <div className="h-2 w-16 bg-white/20 rounded-full"></div>
                           </div>
                        ))}
                     </div>
                  </div>
               </div>
            </motion.div>
          </div>
        </section>

        {/* Features Grid */}
        <section id="features" className="py-32 bg-slate-50">
          <div className="max-w-7xl mx-auto px-6">
            <div className="text-center mb-20 space-y-4">
              <h2 className="text-3xl md:text-5xl font-black tracking-tight text-slate-900">Everything your ministry needs.</h2>
              <p className="text-lg text-slate-500 max-w-2xl mx-auto">Scalable infrastructure that works as hard as your team does.</p>
            </div>
            
            <div className="grid md:grid-cols-3 gap-8">
              {[
                { title: 'Multi-Branch', desc: 'Seamlessly manage multiple locations from a single central command center.', icon: Globe, color: 'indigo' },
                { title: 'Role-Based Access', desc: 'Precise permissions for Pastors, Staff, Workers and Super Admins.', icon: Shield, color: 'emerald' },
                { title: 'Advanced Finances', desc: 'Track tithes, offerings, and expenses with automated reporting.', icon: BarChart3, color: 'amber' },
                { title: 'Member Tracking', desc: 'Complete lifecycle management from first-time visitors to dedicated members.', icon: Users, color: 'sky' },
                { title: 'Mobile App', desc: 'Stay connected on the go with our fully featured Android application.', icon: Smartphone, color: 'rose' },
                { title: 'Lightning Fast', desc: 'Optimized performance ensuring zero lag, even with massive congregations.', icon: Zap, color: 'violet' }
              ].map((feat, i) => (
                <div key={i} className="bg-white p-10 rounded-3xl border border-slate-100 hover:shadow-xl hover:shadow-slate-200/50 transition-all group">
                  <div className={`w-14 h-14 rounded-2xl mb-6 flex items-center justify-center transition-transform group-hover:scale-110 group-hover:rotate-3 shadow-sm bg-${feat.color}-50 text-${feat.color}-600`}>
                    <feat.icon className="w-7 h-7" />
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 mb-3">{feat.title}</h3>
                  <p className="text-slate-500 text-sm leading-relaxed">{feat.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Android Promo */}
        <section className="py-24 bg-indigo-600 relative overflow-hidden">
           <div className="absolute inset-0 opacity-10">
              <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-white via-transparent to-transparent scale-150"></div>
           </div>
           <div className="max-w-7xl mx-auto px-6 relative z-10 flex flex-col md:flex-row items-center gap-12 text-center md:text-left">
              <div className="flex-1 space-y-6">
                 <Badge className="bg-white/20 text-white border-transparent px-4 py-1.5 text-xs font-black tracking-widest uppercase">Mobile Expansion</Badge>
                 <h2 className="text-4xl md:text-6xl font-black text-white tracking-tighter">Your church, in your pocket.</h2>
                 <p className="text-indigo-100 text-lg md:text-xl font-medium max-w-xl">
                    Download the Ecclesia staff app for Android. Manage attendance, process registrations, and view reports from anywhere in the world.
                 </p>
                 <div className="flex flex-col sm:flex-row gap-4 pt-4">
                    <Button className="bg-white text-indigo-600 hover:bg-indigo-50 h-16 rounded-2xl px-10 font-black text-lg gap-3">
                       <Smartphone className="w-6 h-6" />
                       GET FOR ANDROID
                    </Button>
                    <div className="flex -space-x-3 items-center justify-center md:justify-start">
                       {[1, 2, 3, 4].map(i => (
                          <div key={i} className="w-10 h-10 rounded-full border-2 border-indigo-600 bg-slate-200"></div>
                       ))}
                       <span className="ml-6 text-white text-sm font-bold">5,000+ Staff active</span>
                    </div>
                 </div>
              </div>
              <div className="flex-1 flex justify-center">
                 <div className="relative w-72 h-[550px] bg-slate-900 rounded-[3rem] border-[12px] border-slate-800 shadow-2xl flex flex-col overflow-hidden">
                    <div className="w-1/2 h-6 bg-slate-800 absolute top-0 left-1/2 -translate-x-1/2 rounded-b-2xl z-20"></div>
                    <div className="flex-1 p-6 flex flex-col">
                       <div className="h-8 w-8 bg-indigo-500 rounded-lg mb-6"></div>
                       <div className="space-y-4">
                          <div className="h-4 w-3/4 bg-white/10 rounded-full"></div>
                          <div className="h-32 w-full bg-white/5 rounded-xl"></div>
                          <div className="grid grid-cols-2 gap-4">
                             <div className="h-20 bg-white/5 rounded-xl"></div>
                             <div className="h-20 bg-white/5 rounded-xl"></div>
                          </div>
                          <div className="h-40 w-full bg-white/5 rounded-xl"></div>
                       </div>
                    </div>
                 </div>
              </div>
           </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="py-20 border-t border-slate-100 bg-white">
        <div className="max-w-7xl mx-auto px-6 grid md:grid-cols-4 gap-12">
          <div className="col-span-2 space-y-6">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold">
                <Church className="w-4 h-4" />
              </div>
              <span className="font-black text-lg tracking-tight text-slate-900 uppercase">Ecclesia</span>
            </div>
            <p className="text-slate-400 text-sm max-w-sm font-medium">
              Empowering global ministries with high-performance technology. Built for the modern congregation.
            </p>
          </div>
          <div className="space-y-4">
            <h4 className="font-black text-xs uppercase tracking-widest text-slate-900">Platform</h4>
            <ul className="space-y-3 text-sm text-slate-500 font-bold">
              <li><Link to="/login" className="hover:text-indigo-600">Features</Link></li>
              <li><Link to="/login" className="hover:text-indigo-600">Pricing</Link></li>
              <li><Link to="/login" className="hover:text-indigo-600">Security</Link></li>
            </ul>
          </div>
          <div className="space-y-4">
            <h4 className="font-black text-xs uppercase tracking-widest text-slate-900">Support</h4>
            <ul className="space-y-3 text-sm text-slate-500 font-bold">
              <li><Link to="/login" className="hover:text-indigo-600">Help Center</Link></li>
              <li><Link to="/login" className="hover:text-indigo-600">Contact Us</Link></li>
              <li><Link to="/login" className="hover:text-indigo-600">Privacy Policy</Link></li>
            </ul>
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-6 mt-20 pt-8 border-t border-slate-50 flex items-center justify-between text-[10px] font-black text-slate-300 uppercase tracking-widest">
           <div>© 2026 ECCLESIA PLATFORM</div>
           <div className="flex gap-8">
              <span>TWITTER</span>
              <span>GITHUB</span>
              <span>LINKEDIN</span>
           </div>
        </div>
      </footer>
    </div>
  );
}

function Badge({ children, className }: { children: React.ReactNode, className?: string }) {
  return (
    <div className={`inline-flex items-center px-3 py-1 rounded-full border ${className}`}>
      {children}
    </div>
  );
}
