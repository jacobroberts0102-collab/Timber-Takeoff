import React, { useMemo } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area
} from 'recharts';
import { 
  TrendingUp, Package, DollarSign, Ruler, 
  CheckCircle2, BarChart3, PieChart as PieChartIcon, 
  Activity, Layers
} from 'lucide-react';
import { ParsedLine, CatalogProduct, HistoryItem } from '../types';
import { computePineWastage } from '../services/pineWastage';
import { motion } from 'motion/react';

interface DashboardProps {
  data: ParsedLine[];
  catalog: CatalogProduct[];
  history: HistoryItem[];
}

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4'];

export const Dashboard: React.FC<DashboardProps> = ({ data, catalog, history }) => {
  const stats = useMemo(() => {
    const totalItems = data.length;
    const totalLm = data.reduce((acc, curr) => acc + (curr.unit === 'L/M' ? curr.total : 0), 0);
    const totalPrice = data.reduce((acc, curr) => acc + (curr.totalPrice || 0), 0);
    const mappedCount = data.filter(d => d.spruceMapped).length;
    const mappingRate = totalItems > 0 ? (mappedCount / totalItems) * 100 : 0;
    
    // Group by section
    const sectionData = data.reduce((acc, curr) => {
      const section = curr.section || 'Uncategorized';
      if (!acc[section]) acc[section] = { name: section, value: 0, price: 0, count: 0 };
      acc[section].value += curr.unit === 'L/M' ? curr.total : 0;
      acc[section].price += curr.totalPrice || 0;
      acc[section].count += 1;
      return acc;
    }, {} as Record<string, any>);

    const sectionChartData = Object.values(sectionData).sort((a, b) => b.price - a.price);

    // Group by grade
    const gradeData = data.reduce((acc, curr) => {
      const grade = curr.grade || 'Unknown';
      if (!acc[grade]) acc[grade] = { name: grade, value: 0 };
      acc[grade].value += 1;
      return acc;
    }, {} as Record<string, any>);

    const gradeChartData = Object.values(gradeData).sort((a, b) => b.value - a.value);

    // Confidence distribution
    const confidenceData = [
      { name: 'High (90%+)', value: data.filter(d => (d.confidence || 0) >= 0.9).length },
      { name: 'Medium (70-90%)', value: data.filter(d => (d.confidence || 0) >= 0.7 && (d.confidence || 0) < 0.9).length },
      { name: 'Low (<70%)', value: data.filter(d => (d.confidence || 0) < 0.7).length },
    ];

    // Historical Trends
    const historicalTrends = history
      .sort((a, b) => a.timestamp - b.timestamp)
      .map(item => ({
        date: new Date(item.timestamp).toLocaleDateString('en-AU', { month: 'short', day: 'numeric' }),
        value: item.data.reduce((acc, curr) => acc + (curr.totalPrice || 0), 0),
        items: item.itemCount
      }))
      .slice(-10); // Last 10 jobs

    // Pine Wastage
    const { summary: wastageSummary, rows: wastageRows } = computePineWastage(data, catalog);

    return {
      totalItems,
      totalLm,
      totalPrice,
      mappingRate,
      sectionChartData,
      gradeChartData,
      confidenceData,
      historicalTrends,
      wastageSummary,
      wastageRows
    };
  }, [data, catalog, history]);

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: { y: 0, opacity: 1 }
  };

  if (data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-500 space-y-4">
        <BarChart3 size={64} className="opacity-20" />
        <p className="text-xl font-medium">No data to visualize yet.</p>
        <p className="text-sm">Upload a document to see your timber takeoff analytics.</p>
      </div>
    );
  }

  return (
    <motion.div 
      className="p-4 sm:p-10 space-y-12 overflow-y-auto h-full relative"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      style={{ perspective: '1200px' }}
    >
      {/* Header Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <motion.div 
          variants={itemVariants} 
          whileHover={{ y: -8, rotateX: -4, rotateY: 4 }}
          style={{ 
            backfaceVisibility: 'hidden',
            willChange: 'transform'
          }}
          className="bg-white/70 dark:bg-slate-900/70 backdrop-blur-2xl p-7 rounded-[2.5rem] shadow-[0_20px_50px_-12px_rgba(0,0,0,0.08)] dark:shadow-none border border-white/50 dark:border-slate-800/50 flex flex-col gap-5 relative overflow-hidden group transition-colors hover:bg-white/90 dark:hover:bg-slate-900/90"
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-3xl -mr-16 -mt-16 group-hover:bg-emerald-500/20 transition-colors"></div>
          <div className="p-3.5 w-fit bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-[1.25rem] ring-1 ring-emerald-500/20 shadow-lg shadow-emerald-500/10">
            <DollarSign size={24} />
          </div>
          <div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-black uppercase tracking-[0.2em] mb-2">Project Value</p>
            <p className="text-3xl font-black text-slate-900 dark:text-white leading-none mb-2 tracking-tighter">${stats.totalPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
            <p className="text-[10px] text-emerald-600 font-bold uppercase tracking-tight opacity-80">Estimated Materials</p>
          </div>
        </motion.div>

        <motion.div 
          variants={itemVariants} 
          whileHover={{ y: -8, rotateX: -4, rotateY: 4 }}
          style={{ 
            backfaceVisibility: 'hidden',
            willChange: 'transform'
          }}
          className="bg-white/70 dark:bg-slate-900/70 backdrop-blur-2xl p-7 rounded-[2.5rem] shadow-[0_20px_50px_-12px_rgba(0,0,0,0.08)] dark:shadow-none border border-white/50 dark:border-slate-800/50 flex flex-col gap-5 relative overflow-hidden group transition-colors hover:bg-white/90 dark:hover:bg-slate-900/90"
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-3xl -mr-16 -mt-16 group-hover:bg-blue-500/20 transition-colors"></div>
          <div className="p-3.5 w-fit bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-[1.25rem] ring-1 ring-blue-500/20 shadow-lg shadow-blue-500/10">
            <Ruler size={24} />
          </div>
          <div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-black uppercase tracking-[0.2em] mb-2">Total Length</p>
            <p className="text-3xl font-black text-slate-900 dark:text-white leading-none mb-2 tracking-tighter">{stats.totalLm.toFixed(1)}m</p>
            <p className="text-[10px] text-blue-600 font-bold uppercase tracking-tight opacity-80">Linear Metres Req.</p>
          </div>
        </motion.div>

        <motion.div 
          variants={itemVariants} 
          whileHover={{ y: -8, rotateX: -4, rotateY: 4 }}
          style={{ 
            backfaceVisibility: 'hidden',
            willChange: 'transform'
          }}
          className="bg-white/70 dark:bg-slate-900/70 backdrop-blur-2xl p-7 rounded-[2.5rem] shadow-[0_20px_50px_-12px_rgba(0,0,0,0.08)] dark:shadow-none border border-white/50 dark:border-slate-800/50 flex flex-col gap-5 relative overflow-hidden group transition-colors hover:bg-white/90 dark:hover:bg-slate-900/90"
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/10 rounded-full blur-3xl -mr-16 -mt-16 group-hover:bg-amber-500/20 transition-colors"></div>
          <div className="p-3.5 w-fit bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-[1.25rem] ring-1 ring-amber-500/20 shadow-lg shadow-amber-500/10">
            <Package size={24} />
          </div>
          <div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-black uppercase tracking-[0.2em] mb-2">Unique Items</p>
            <p className="text-3xl font-black text-slate-900 dark:text-white leading-none mb-2 tracking-tighter">{stats.totalItems}</p>
            <p className="text-[10px] text-amber-600 font-bold uppercase tracking-tight opacity-80">Different Pieces</p>
          </div>
        </motion.div>

        <motion.div 
          variants={itemVariants} 
          whileHover={{ y: -8, rotateX: -4, rotateY: 4 }}
          style={{ 
            backfaceVisibility: 'hidden',
            willChange: 'transform'
          }}
          className="bg-white/70 dark:bg-slate-900/70 backdrop-blur-2xl p-7 rounded-[2.5rem] shadow-[0_20px_50px_-12px_rgba(0,0,0,0.08)] dark:shadow-none border border-white/50 dark:border-slate-800/50 flex flex-col gap-5 relative overflow-hidden group transition-colors hover:bg-white/90 dark:hover:bg-slate-900/90"
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/10 rounded-full blur-3xl -mr-16 -mt-16 group-hover:bg-purple-500/20 transition-colors"></div>
          <div className="p-3.5 w-fit bg-purple-500/10 text-purple-600 dark:text-purple-400 rounded-[1.25rem] ring-1 ring-purple-500/20 shadow-lg shadow-purple-500/10">
            <TrendingUp size={24} />
          </div>
          <div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-black uppercase tracking-[0.2em] mb-2">Store Link</p>
            <p className="text-3xl font-black text-slate-900 dark:text-white leading-none mb-2 tracking-tighter">{stats.mappingRate.toFixed(1)}%</p>
            <p className="text-[10px] text-purple-600 font-bold uppercase tracking-tight opacity-80">Catalog Connection</p>
          </div>
        </motion.div>
      </div>

      {/* Main Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
        {/* Section Value Distribution */}
        <motion.div variants={itemVariants} className="bg-white/70 dark:bg-slate-900/70 backdrop-blur-2xl p-10 rounded-[3rem] shadow-[0_30px_60px_-15px_rgba(0,0,0,0.1)] dark:shadow-none border border-white/50 dark:border-slate-800/50 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-emerald-500/[0.02] to-transparent pointer-events-none"></div>
          <div className="flex items-center justify-between mb-10 relative z-10">
            <h3 className="font-black text-2xl text-slate-900 dark:text-white flex items-center gap-4 uppercase tracking-tighter">
              <div className="w-12 h-12 bg-emerald-500/10 rounded-2xl flex items-center justify-center text-emerald-500 ring-1 ring-emerald-500/20 shadow-lg shadow-emerald-500/10">
                <Layers size={24} />
              </div>
              Value by Section
            </h3>
          </div>
          <div className="h-80 relative z-10">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.sectionChartData} layout="vertical" margin={{ left: 20 }}>
                <defs>
                  <linearGradient id="barGrad" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#10b981" />
                    <stop offset="100%" stopColor="#34d399" />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="10 10" horizontal={true} vertical={false} stroke="#64748b" opacity={0.15} />
                <XAxis type="number" hide />
                <YAxis 
                  dataKey="name" 
                  type="category" 
                  width={100} 
                  axisLine={false} 
                  tickLine={false}
                  tick={{ fontSize: 11, fill: '#64748b', fontWeight: 800 }}
                />
                <Tooltip 
                  cursor={{ fill: 'rgba(0,0,0,0.02)' }}
                  contentStyle={{ borderRadius: '24px', border: 'none', background: 'rgba(15, 23, 42, 0.95)', color: '#fff', boxShadow: '0 25px 50px -12px rgb(0 0 0 / 0.5)' }}
                  formatter={(value: number) => [`$${value.toLocaleString()}`, 'Value']}
                />
                <Bar dataKey="price" fill="url(#barGrad)" radius={[0, 16, 16, 0]} barSize={36} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* Grade Distribution */}
        <motion.div variants={itemVariants} className="bg-white/70 dark:bg-slate-900/70 backdrop-blur-2xl p-10 rounded-[3rem] shadow-[0_30px_60px_-15px_rgba(0,0,0,0.1)] dark:shadow-none border border-white/50 dark:border-slate-800/50">
          <div className="flex items-center justify-between mb-10">
            <h3 className="font-black text-2xl text-slate-900 dark:text-white flex items-center gap-4 uppercase tracking-tighter">
              <div className="w-12 h-12 bg-blue-500/10 rounded-2xl flex items-center justify-center text-blue-500 ring-1 ring-blue-500/20 shadow-lg shadow-blue-500/10">
                <PieChartIcon size={24} />
              </div>
              Grade Distribution
            </h3>
          </div>
          <div className="h-80 flex flex-col sm:flex-row items-center gap-12">
            <div className="w-full sm:w-1/2 h-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={stats.gradeChartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={75}
                    outerRadius={105}
                    paddingAngle={10}
                    dataKey="value"
                    stroke="none"
                  >
                    {stats.gradeChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ borderRadius: '24px', border: 'none', background: 'rgba(15, 23, 42, 0.95)', color: '#fff' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="w-full sm:w-1/2 space-y-4">
              {stats.gradeChartData.slice(0, 5).map((item, index) => (
                <div key={item.name} className="flex items-center justify-between p-4 rounded-2xl hover:bg-slate-500/10 transition-all group">
                  <div className="flex items-center space-x-4">
                    <div className="w-4 h-4 rounded-full ring-4 ring-offset-2 ring-transparent group-hover:ring-slate-100 dark:ring-offset-slate-900 transition-all" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                    <span className="text-sm text-slate-600 dark:text-slate-400 font-extrabold truncate max-w-[140px] group-hover:text-slate-900 dark:group-hover:text-white transition-colors">{item.name}</span>
                  </div>
                  <span className="text-[10px] text-slate-400 font-black tracking-widest">{item.value} ITEMS</span>
                </div>
              ))}
            </div>
          </div>
        </motion.div>

        {/* Pine Wastage Analysis */}
        <motion.div 
          variants={itemVariants} 
          whileHover={{ y: -10, scale: 1.01 }}
          style={{ 
            backfaceVisibility: 'hidden',
            willChange: 'transform'
          }}
          className="bg-white/70 dark:bg-slate-900/70 backdrop-blur-2xl p-12 rounded-[4rem] shadow-[0_45px_100px_-25px_rgba(0,0,0,0.12)] dark:shadow-none border border-white/80 dark:border-slate-800/80 lg:col-span-2 relative overflow-hidden group"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500/[0.04] to-transparent pointer-events-none"></div>
          <div className="flex flex-col xl:flex-row xl:items-center justify-between mb-12 gap-8 relative z-10">
            <h3 className="font-black text-3xl text-slate-900 dark:text-white flex items-center gap-5 uppercase tracking-tighter">
              <div className="w-14 h-14 bg-blue-600/10 rounded-2xl flex items-center justify-center text-blue-600 ring-1 ring-blue-600/20 shadow-xl shadow-blue-500/10">
                <Ruler size={28} />
              </div>
              Wastage Analysis <span className="text-slate-400 font-medium ml-2 text-lg hidden sm:inline">(6.0m Stock)</span>
            </h3>
            <div className="flex items-center gap-10 bg-white/50 dark:bg-slate-800/50 p-6 rounded-[2rem] border border-white/50 dark:border-slate-700/50 shadow-inner">
              <div className="text-center sm:text-right">
                <p className="text-[11px] text-slate-400 font-black uppercase tracking-[0.3em] mb-2">Overall Waste</p>
                <p className={`text-3xl font-black ${stats.wastageSummary.overallWastagePct > 15 ? 'text-red-500' : 'text-emerald-500'} tracking-tighter`}>
                  {stats.wastageSummary.overallWastagePct.toFixed(1)}%
                </p>
              </div>
              <div className="w-px h-12 bg-slate-200 dark:bg-slate-700 opacity-50"></div>
              <div className="text-center sm:text-right">
                <p className="text-[11px] text-slate-400 font-black uppercase tracking-[0.3em] mb-2">Offcuts Total</p>
                <p className="text-3xl font-black text-slate-900 dark:text-white tracking-tighter">{stats.wastageSummary.totalOffcutLm.toFixed(1)}m</p>
              </div>
            </div>
          </div>
          
          <div className="grid grid-cols-1 xl:grid-cols-5 gap-16 relative z-10">
            <div className="xl:col-span-3 h-96">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.wastageRows.slice(0, 8)}>
                  <defs>
                    <linearGradient id="wasteGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#3b82f6" />
                      <stop offset="100%" stopColor="#60a5fa" />
                    </linearGradient>
                    <linearGradient id="wasteGradHigh" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#ef4444" />
                      <stop offset="100%" stopColor="#f87171" />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="12 12" vertical={false} stroke="#64748b" opacity={0.15} />
                  <XAxis dataKey="dimsLabel" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b', fontWeight: 800 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b', fontWeight: 800 }} />
                  <Tooltip 
                    contentStyle={{ borderRadius: '24px', border: 'none', background: 'rgba(15, 23, 42, 0.95)', color: '#fff', boxShadow: '0 30px 60px -12px rgb(0 0 0 / 0.6)' }}
                  />
                  <Bar dataKey="wastagePct" name="Wastage %" radius={[16, 16, 0, 0]} barSize={64}>
                    {stats.wastageRows.slice(0, 8).map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.wastagePct > 20 ? 'url(#wasteGradHigh)' : 'url(#wasteGrad)'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            
            <div className="xl:col-span-2 space-y-8">
              <p className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.3em]">Critical Impact Points</p>
              <div className="space-y-5">
                {stats.wastageRows.slice(0, 5).map((row) => (
                  <motion.div 
                    key={row.dimsKey} 
                    whileHover={{ x: 10, scale: 1.02 }}
                    className="flex flex-col p-6 rounded-[2.5rem] bg-white/50 dark:bg-slate-800/50 border border-white dark:border-slate-700/50 shadow-xl shadow-slate-200/20 dark:shadow-none backdrop-blur-md"
                  >
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight">{row.dimsLabel}</span>
                      <span className={`text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest ${row.wastagePct > 20 ? 'bg-red-500 text-white shadow-lg shadow-red-500/20' : 'bg-blue-600 text-white shadow-lg shadow-blue-600/20'}`}>
                        {row.wastagePct}% Loss
                      </span>
                    </div>
                    <div className="w-full bg-slate-200/40 dark:bg-slate-700/40 rounded-full h-3 overflow-hidden shadow-inner ring-1 ring-slate-100 dark:ring-slate-800">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.min(row.wastagePct, 100)}%` }}
                        transition={{ duration: 1.5, type: 'spring', bounce: 0.4 }}
                        className={`h-full rounded-full ${row.wastagePct > 20 ? 'bg-gradient-to-r from-red-500 to-orange-400' : 'bg-gradient-to-r from-blue-700 to-blue-400'}`}
                      />
                    </div>
                    <div className="flex items-center justify-between mt-5 text-[10px] text-slate-400 font-extrabold uppercase tracking-widest">
                      <span className="flex items-center gap-2"><Ruler size={10}/> {row.totalLm.toFixed(1)}m Required</span>
                      <span className="flex items-center gap-2"><Package size={10}/> {row.lengths6m} Stock Units</span>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>
        </motion.div>

        {/* Scanner Accuracy */}
        <motion.div variants={itemVariants} className="bg-white/70 dark:bg-slate-900/70 backdrop-blur-2xl p-10 rounded-[3rem] shadow-[0_30px_60px_-15px_rgba(0,0,0,0.1)] dark:shadow-none border border-white/50 dark:border-slate-800/50">
          <div className="flex items-center justify-between mb-10">
            <h3 className="font-black text-2xl text-slate-900 dark:text-white flex items-center gap-4 uppercase tracking-tighter">
              <div className="w-12 h-12 bg-amber-500/10 rounded-2xl flex items-center justify-center text-amber-500 ring-1 ring-amber-500/20 shadow-lg shadow-amber-500/10">
                <CheckCircle2 size={24} />
              </div>
              Scanner Accuracy
            </h3>
          </div>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stats.confidenceData}>
                <defs>
                  <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="12 12" vertical={false} stroke="#64748b" opacity={0.15} />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b', fontWeight: 800 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b', fontWeight: 800 }} />
                <Tooltip 
                  contentStyle={{ borderRadius: '24px', border: 'none', background: 'rgba(15, 23, 42, 0.95)', color: '#fff', boxShadow: '0 25px 50px -12px rgb(0 0 0 / 0.5)' }}
                />
                <Area type="monotone" dataKey="value" stroke="#f59e0b" fillOpacity={1} fill="url(#colorValue)" strokeWidth={6} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* Project Categories */}
        <motion.div variants={itemVariants} className="bg-white/70 dark:bg-slate-900/70 backdrop-blur-2xl p-10 rounded-[3rem] shadow-[0_30px_60px_-15px_rgba(0,0,0,0.1)] dark:shadow-none border border-white/50 dark:border-slate-800/50">
          <div className="flex items-center justify-between mb-10">
            <h3 className="font-black text-2xl text-slate-900 dark:text-white flex items-center gap-4 uppercase tracking-tighter">
              <div className="w-12 h-12 bg-purple-500/10 rounded-2xl flex items-center justify-center text-purple-500 ring-1 ring-purple-500/20 shadow-lg shadow-purple-500/10">
                <Activity size={24} />
              </div>
              Project Categories
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-[11px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.3em] border-b border-slate-100 dark:border-slate-800">
                  <th className="pb-5 text-left px-4">Section Name</th>
                  <th className="pb-5 text-center">Items</th>
                  <th className="pb-5 text-right px-4">Estimated Value</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                {stats.sectionChartData.slice(0, 6).map((section) => (
                  <tr key={section.name} className="group hover:bg-slate-500/5 transition-all">
                    <td className="py-5 px-4 text-sm font-black text-slate-800 dark:text-slate-200 uppercase tracking-tighter group-hover:text-purple-600 transition-colors">{section.name}</td>
                    <td className="py-5 text-sm text-center text-slate-500 dark:text-slate-400 font-mono font-bold">{section.count}</td>
                    <td className="py-5 px-4 text-right">
                      <span className="inline-flex items-center bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-4 py-1.5 rounded-2xl ring-1 ring-emerald-500/20 shadow-sm font-black text-sm">
                        ${section.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>

        {/* History & Volume Trend */}
        <motion.div variants={itemVariants} className="bg-white/70 dark:bg-slate-900/70 backdrop-blur-2xl p-12 rounded-[4rem] shadow-[0_45px_100px_-25px_rgba(0,0,0,0.12)] dark:shadow-none border border-white/80 dark:border-slate-800/80 lg:col-span-2 relative overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-to-tr from-blue-500/[0.04] to-transparent pointer-events-none"></div>
          <div className="flex items-center justify-between mb-12 relative z-10">
            <h3 className="font-black text-3xl text-slate-900 dark:text-white flex items-center gap-5 uppercase tracking-tighter">
              <div className="w-14 h-14 bg-blue-600/10 rounded-2xl flex items-center justify-center text-blue-600 ring-1 ring-blue-600/20 shadow-xl shadow-blue-500/10">
                <TrendingUp size={28} />
              </div>
              History & Volume
            </h3>
          </div>
          <div className="h-96 relative z-10">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stats.historicalTrends}>
                <defs>
                  <linearGradient id="colorValueHist" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="14 14" vertical={false} stroke="#64748b" opacity={0.15} />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b', fontWeight: 800 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b', fontWeight: 800 }} />
                <Tooltip 
                  contentStyle={{ borderRadius: '24px', border: 'none', background: 'rgba(15, 23, 42, 0.95)', color: '#fff', boxShadow: '0 40px 80px -15px rgb(0 0 0 / 0.6)' }}
                  formatter={(value: number) => [`$${value.toLocaleString()}`, 'Job Value']}
                />
                <Area type="monotone" dataKey="value" stroke="#3b82f6" strokeWidth={8} fillOpacity={1} fill="url(#colorValueHist)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
};
