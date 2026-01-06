'use client';

import { motion, useScroll, useTransform } from 'framer-motion';
import {
    Anchor,
    Brain,
    ChevronDown,
    Globe2,
    LayoutDashboard,
    Leaf,
    LineChart,
    Menu,
    MessageCircle,
    Ship,
    Smartphone,
    TrendingUp,
    Users,
    Utensils
} from 'lucide-react';
import Link from 'next/link';
import { useRef, useState, useEffect } from 'react';

// --- Components ---

const Navbar = () => {
    const [scrolled, setScrolled] = useState(false);

    useEffect(() => {
        const handleScroll = () => setScrolled(window.scrollY > 50);
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    return (
        <motion.header
            initial={{ y: -100 }}
            animate={{ y: 0 }}
            className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${scrolled ? 'bg-slate-900/80 backdrop-blur-md py-4 shadow-lg' : 'bg-transparent py-6'
                }`}
        >
            <div className="max-w-7xl mx-auto px-6 flex justify-between items-center text-white">
                <Link href="/" className="flex items-center gap-2 group">
                    <span className="text-xl font-bold tracking-wide">WELLSHIP</span>
                </Link>
                <div className="flex items-center gap-4">
                    <Link
                        href="/login"
                        className="px-6 py-2.5 bg-white/10 hover:bg-white/20 border border-white/20 rounded-full backdrop-blur-sm transition-all duration-300 font-medium text-sm tracking-wide"
                    >
                        ログイン
                    </Link>
                </div>
            </div>
        </motion.header>
    );
};

const HeroSection = () => {
    const ref = useRef(null);
    const { scrollYProgress } = useScroll({
        target: ref,
        offset: ["start start", "end start"]
    });

    const y = useTransform(scrollYProgress, [0, 1], ["0%", "50%"]);
    const opacity = useTransform(scrollYProgress, [0, 1], [1, 0]);

    return (
        <section ref={ref} className="relative h-screen flex items-center justify-center overflow-hidden bg-slate-900">
            {/* Background Image with Parallax */}
            <motion.div
                style={{ y, opacity }}
                className="absolute inset-0 z-0"
            >
                <div className="absolute inset-0 bg-gradient-to-b from-slate-900/30 via-slate-900/50 to-slate-900 z-10" />
                <img
                    src="/landing-hero.png"
                    alt="Ocean Grandeur"
                    className="w-full h-full object-cover scale-105"
                />
            </motion.div>

            {/* Hero Content */}
            <div className="relative z-20 max-w-5xl mx-auto px-6 text-center">
                <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 1, delay: 0.2 }}
                >
                    <span className="inline-block py-1 px-3 rounded-full bg-blue-500/20 border border-blue-400/30 text-blue-300 text-sm font-medium mb-6 uppercase tracking-wider backdrop-blur-sm">
                        AI×海運栄養管理の最前線
                    </span>
                    <h1 className="text-5xl md:text-7xl font-bold text-white mb-8 leading-tight tracking-tight">
                        船上の食と健康を<br />
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-cyan-300 to-teal-200">
                            WELLSHIP
                        </span>
                        で革新する
                    </h1>
                    <p className="text-lg md:text-xl text-slate-300 mb-12 max-w-2xl mx-auto leading-relaxed">
                        WELLSHIPは、船上の食事管理を最適化するAIプラットフォームです。<br className="hidden md:block" />
                        献立作成から在庫管理、クルーの満足度向上までを一気通貫でサポート。<br className="hidden md:block" />
                        持続可能な航海とESG経営の実現に貢献します。
                    </p>

                    <div className="flex flex-col sm:flex-row gap-5 justify-center">
                        <Link href="/login">
                            <button className="group relative px-8 py-4 bg-gradient-to-r from-blue-600 to-cyan-600 text-white rounded-full font-semibold overflow-hidden shadow-[0_0_40px_-10px_rgba(37,99,235,0.5)] transition-all hover:shadow-[0_0_60px_-10px_rgba(37,99,235,0.7)] hover:scale-105">
                                <span className="relative z-10 flex items-center gap-2">
                                    デモをリクエスト <ChevronDown className="w-4 h-4 rotate-[-90deg] group-hover:translate-x-1 transition-transform" />
                                </span>
                                <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out" />
                            </button>
                        </Link>
                        <button className="px-8 py-4 bg-white/5 border border-white/10 text-white rounded-full font-semibold hover:bg-white/10 backdrop-blur-sm transition-all">
                            機能を見る
                        </button>
                    </div>
                </motion.div>
            </div>

            {/* Scroll Indicator */}
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1.5, duration: 1 }}
                className="absolute bottom-10 left-1/2 -translate-x-1/2 z-20 text-white/50 flex flex-col items-center gap-2"
            >
                <span className="text-xs uppercase tracking-widest">Scroll</span>
                <motion.div
                    animate={{ y: [0, 8, 0] }}
                    transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
                >
                    <ChevronDown className="w-5 h-5" />
                </motion.div>
            </motion.div>
        </section>
    );
};

const FeatureCard = ({ icon: Icon, title, subTitle, desc, delay, color }: any) => (
    <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6, delay }}
        className="group p-8 rounded-3xl bg-white/5 border border-white/10 hover:border-white/20 backdrop-blur-sm transition-all hover:-translate-y-1 hover:shadow-2xl hover:shadow-blue-900/20"
    >
        <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${color} flex items-center justify-center mb-6 shadow-lg group-hover:scale-110 transition-transform duration-500`}>
            <Icon className="w-7 h-7 text-white" />
        </div>
        <div className="mb-3">
            <h3 className="text-xl font-bold text-white tracking-wide">{title}</h3>
            {subTitle && <span className="text-xs text-blue-300 uppercase tracking-widest font-semibold">{subTitle}</span>}
        </div>
        <p className="text-slate-400 leading-relaxed text-sm">{desc}</p>
    </motion.div>
);

const FeaturesSection = () => {
    return (
        <section className="py-32 bg-slate-950 relative overflow-hidden">
            <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 brightness-100 contrast-150 mix-blend-overlay"></div>
            <div className="max-w-7xl mx-auto px-6 relative z-10">
                <div className="text-center mb-20">
                    <motion.h2
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.8 }}
                        className="text-3xl md:text-5xl font-bold text-white mb-6"
                    >
                        Comprehensive Fleet Management
                    </motion.h2>
                    <p className="text-slate-400 max-w-2xl mx-auto">
                        船上の課題を解決するために設計された、データ駆動型ツールスイート。<br />
                        司厨長から経営層まで、あらゆるロールの意思決定を支援します。
                    </p>
                </div>

                <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <FeatureCard
                        icon={Utensils}
                        title="AI献立作成"
                        subTitle="Smart Planning"
                        desc="予算、在庫、乗組員の好みを考慮し、最適な献立を自動生成。献立作成にかかる時間を最大80%削減します。"
                        delay={0.1}
                        color="from-orange-400 to-pink-500"
                    />
                    <FeatureCard
                        icon={MessageCircle}
                        title="クルーフィードバック"
                        subTitle="Crew Engagement"
                        desc="NFCを使った直感的なフィードバック収集。クルーの「美味しい」を見える化し、モチベーション向上に繋げます。"
                        delay={0.2}
                        color="from-blue-400 to-cyan-500"
                    />
                    <FeatureCard
                        icon={LayoutDashboard}
                        title="調達・在庫管理"
                        subTitle="Unified Procurement"
                        desc="サプライヤーとのシームレスな連携。発注リストの自動作成と在庫管理の効率化で、無駄な発注を防ぎます。"
                        delay={0.3}
                        color="from-emerald-400 to-green-500"
                    />
                    <FeatureCard
                        icon={TrendingUp}
                        title="ESG分析レポート"
                        subTitle="ESG Analytics"
                        desc="フードロス削減量や満足度（Wellbeing）を可視化。ESGレポート作成に必要なデータをワンクリックで出力。"
                        delay={0.4}
                        color="from-purple-400 to-indigo-500"
                    />
                </div>
            </div>
        </section>
    );
};

const HowItWorksSection = () => {
    const steps = [
        {
            number: "01",
            title: "Smart Planning",
            jpTitle: "AI献立作成",
            desc: "AIが乗組員の構成、在庫、予算に基づいて最適な献立を瞬時に生成します。",
            icon: Brain,
            color: "from-blue-600 to-cyan-500"
        },
        {
            number: "02",
            title: "Seamless Operation",
            jpTitle: "現場運用とフィードバック",
            desc: "タブレットでの簡単操作とNFCによるリアルタイムなフィードバック収集を実現。",
            icon: Smartphone,
            color: "from-cyan-500 to-teal-400"
        },
        {
            number: "03",
            title: "Total Optimization",
            jpTitle: "分析と次への改善",
            desc: "蓄積されたデータを分析し、フードロス削減と乗組員の満足度を最大化します。",
            icon: LineChart,
            color: "from-teal-400 to-emerald-500"
        }
    ];

    return (
        <section className="py-32 bg-slate-900 relative overflow-hidden">
            <div className="max-w-7xl mx-auto px-6 relative z-10">
                <div className="text-center mb-24">
                    <motion.span
                        initial={{ opacity: 0 }}
                        whileInView={{ opacity: 1 }}
                        className="text-blue-400 font-semibold tracking-widest uppercase mb-4 block"
                    >
                        How it Works
                    </motion.span>
                    <motion.h2
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        className="text-4xl md:text-6xl font-bold text-white mb-6"
                    >
                        WELLSHIP 導入の3ステップ
                    </motion.h2>
                </div>

                <div className="relative">
                    {/* Connecting Line (Desktop) */}
                    <div className="hidden lg:block absolute top-1/2 left-0 w-full h-0.5 bg-gradient-to-r from-blue-500/0 via-blue-500/20 to-blue-500/0 -translate-y-1/2" />

                    <div className="grid md:grid-cols-3 gap-12 relative">
                        {steps.map((step, index) => (
                            <motion.div
                                key={index}
                                initial={{ opacity: 0, y: 30 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.6, delay: index * 0.2 }}
                                viewport={{ once: true }}
                                className="relative group"
                            >
                                <div className="absolute -top-12 left-0 text-8xl font-bold text-white/[0.03] select-none group-hover:text-blue-500/[0.05] transition-colors duration-500">
                                    {step.number}
                                </div>
                                <div className="p-8 rounded-3xl bg-white/5 border border-white/10 backdrop-blur-sm relative hover:border-blue-500/30 transition-all duration-500">
                                    <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${step.color} flex items-center justify-center mb-8 shadow-xl group-hover:scale-110 transition-transform duration-500`}>
                                        <step.icon className="w-8 h-8 text-white" />
                                    </div>
                                    <span className="text-blue-400 text-sm font-bold tracking-widest uppercase mb-2 block">
                                        Step {step.number}
                                    </span>
                                    <h3 className="text-2xl font-bold text-white mb-4">
                                        {step.jpTitle}
                                        <span className="block text-xs text-slate-500 mt-1 uppercase tracking-wider font-medium">{step.title}</span>
                                    </h3>
                                    <p className="text-slate-400 leading-relaxed">
                                        {step.desc}
                                    </p>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </div>
        </section>
    );
};

const StatItem = ({ value, label, unit, delay }: any) => (
    <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        whileInView={{ opacity: 1, scale: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.8, delay }}
        className="text-center"
    >
        <div className="flex items-end justify-center gap-1 mb-3">
            <div className="text-5xl md:text-6xl font-bold bg-clip-text text-transparent bg-gradient-to-b from-white to-slate-400 font-mono">
                {value}
            </div>
            {unit && <div className="text-2xl text-slate-400 font-bold mb-2">{unit}</div>}
        </div>
        <div className="text-blue-200/80 text-sm uppercase tracking-widest font-medium">
            {label}
        </div>
    </motion.div>
);

const ImpactSection = () => {
    return (
        <section className="py-32 bg-gradient-to-b from-slate-900 to-blue-950 relative overflow-hidden">
            {/* Abstract Waves */}
            <div className="absolute inset-0 opacity-10">
                <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                    <path d="M0 50 Q 25 20 50 50 T 100 50 V 100 H 0 Z" fill="white" />
                </svg>
            </div>

            <div className="max-w-7xl mx-auto px-6 relative z-10">
                <div className="grid md:grid-cols-2 gap-12 items-center mb-20">
                    <motion.div
                        initial={{ opacity: 0, x: -50 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 1 }}
                    >
                        <span className="text-blue-400 font-medium tracking-widest uppercase mb-4 block">Proven Impact</span>
                        <h2 className="text-4xl md:text-5xl font-bold text-white mb-6 leading-tight">
                            導入効果と<br />
                            <span className="text-blue-300">持続可能な未来</span>
                        </h2>
                        <p className="text-slate-300 text-lg leading-relaxed">
                            サプライチェーンの最適化とクルーの満足度向上により、<br className="hidden md:block" />
                            WELLSHIPは確実なROIとESG経営への貢献を実現します。
                        </p>
                    </motion.div>
                    <div className="grid grid-cols-2 gap-12">
                        <StatItem value="30" unit="%" label="フードロス削減" delay={0.2} />
                        <StatItem value="50" unit="%" label="作業時間削減" delay={0.4} />
                        <StatItem value="4.2" unit="pt" label="平均満足度 (5段階)" delay={0.6} />
                        <StatItem value="100" unit="%" label="在庫管理精度" delay={0.8} />
                    </div>
                </div>
            </div>
        </section>
    );
};

const CTASection = () => {
    return (
        <section className="py-32 relative bg-slate-950 overflow-hidden">
            <div className="absolute inset-0 bg-blue-600/10 blur-[100px] rounded-full top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px]"></div>

            <div className="max-w-4xl mx-auto px-6 text-center relative z-10">
                <motion.h2
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8 }}
                    className="text-4xl md:text-6xl font-bold text-white mb-8"
                >
                    Ready to Modernize Your Fleet?
                </motion.h2>
                <p className="text-xl text-slate-400 mb-12">
                    WELLSHIPで、次世代の船舶管理を始めましょう。
                </p>
                <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.5, delay: 0.2 }}
                >
                    <Link
                        href="/login"
                        className="inline-flex items-center gap-3 px-10 py-5 bg-white text-slate-900 rounded-full font-bold text-lg hover:bg-blue-50 transition-colors shadow-2xl shadow-blue-900/50"
                    >
                        無料でデモを試す <Anchor className="w-5 h-5 text-blue-600" />
                    </Link>
                </motion.div>
            </div>
        </section>
    );
};

const Footer = () => (
    <footer className="bg-slate-950 border-t border-white/5 py-12 text-slate-500 text-sm">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="flex items-center gap-2 text-slate-400">
                <Ship className="w-5 h-5" />
                <span className="font-semibold tracking-wide">WELLSHIP</span>
            </div>
            <div className="flex gap-8">
                <a href="#" className="hover:text-white transition-colors">プライバシーポリシー</a>
                <a href="#" className="hover:text-white transition-colors">利用規約</a>
                <a href="#" className="hover:text-white transition-colors">お問い合わせ</a>
            </div>
            <div>
                &copy; 2024 WELLSHIP PoC. All rights reserved.
            </div>
        </div>
    </footer>
);

export function LandingPage() {
    return (
        <div className="min-h-screen bg-slate-950 text-slate-200">
            <Navbar />
            <HeroSection />
            <FeaturesSection />
            <HowItWorksSection />
            <ImpactSection />
            <CTASection />
            <Footer />
        </div>
    );
}
