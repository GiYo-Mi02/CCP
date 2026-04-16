'use client';
import React, { useState, useEffect } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import Link from 'next/link';
import { X, Check, ArrowLeft, Minus } from 'lucide-react';

export default function QuickMotionPage() {
  const [hasVoted, setHasVoted] = useState(false);
  const [voteType, setVoteType] = useState<string | null>(null);
  
  // Realtime mock data
  const [data, setData] = useState([
    { name: 'ADAPT', value: 45, color: '#16A34A' },
    { name: 'QUASH', value: 30, color: '#DC2626' },
    { name: 'ABSTAIN', value: 15, color: '#6B7280' },
  ]);

  // Simulate real-time updates from other delegates
  useEffect(() => {
    const interval = setInterval(() => {
      setData(prevData => {
        const newData = [...prevData];
        // Randomly add a vote to one of the options
        const randomIndex = Math.floor(Math.random() * 3);
        newData[randomIndex] = {
          ...newData[randomIndex],
          value: newData[randomIndex].value + 1
        };
        return newData;
      });
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  const totalVotes = data.reduce((sum, item) => sum + item.value, 0);

  const handleVote = (vote: string) => {
    if (window.confirm(`Confirm your vote: ${vote}?`)) {
      setHasVoted(true);
      setVoteType(vote);
      
      // Optimistically update the chart with the user's vote
      setData(prevData => {
        return prevData.map(item => {
          if (item.name === vote) {
            return { ...item, value: item.value + 1 };
          }
          return item;
        });
      });
    }
  };

  return (
    <div className="min-h-screen bg-ccd-bg flex flex-col pt-8 sm:pt-0 sm:justify-center items-center px-4">
      
      {/* Back button */}
      <Link href="/home" className="absolute top-6 left-6 p-3 bg-white rounded-full shadow-sm hover:shadow-md transition-shadow">
        <ArrowLeft className="w-5 h-5 text-ccd-text-sec" />
      </Link>

      <div className="w-full max-w-3xl bg-white rounded-[2.5rem] border border-ccd-accent/20 shadow-xl shadow-ccd-text/5 p-8 sm:p-12 mb-8">
        
        <div className="text-center mb-8">
          <h1 className="font-serif text-3xl sm:text-4xl font-bold text-ccd-text mb-2">
            Quick Motion Votation
          </h1>
          <p className="text-ccd-text-sec uppercase tracking-widest text-sm font-bold">
            Live Results
          </p>
        </div>

        <div className="h-[250px] sm:h-[300px] w-full relative">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={80}
                outerRadius={120}
                paddingAngle={2}
                dataKey="value"
                stroke="none"
                animationDuration={800}
              >
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip 
                contentStyle={{ borderRadius: '12px', border: '1px solid rgba(196, 168, 130, 0.3)', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                itemStyle={{ color: '#2C1810', fontWeight: 'bold' }}
              />
            </PieChart>
          </ResponsiveContainer>
          
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span className="font-serif text-4xl font-bold text-ccd-text transition-all duration-300">{totalVotes}</span>
            <span className="text-[10px] uppercase tracking-widest font-bold text-ccd-text-sec">Total Votes</span>
          </div>
        </div>

        {/* Legend */}
        <div className="flex justify-center gap-6 mt-4">
          {data.map((entry, index) => (
            <div key={index} className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: entry.color }}></div>
              <span className="text-sm font-bold text-ccd-text-sec uppercase">{entry.name} <span className="opacity-60 ml-1">({entry.value})</span></span>
            </div>
          ))}
        </div>

        <div className="mt-12 pt-8 border-t border-ccd-accent/20">
          {!hasVoted ? (
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button 
                onClick={() => handleVote('QUASH')}
                className="flex-1 min-w-[150px] py-4 bg-white hover:bg-ccd-danger text-ccd-danger hover:text-white border-2 border-ccd-danger/30 rounded-2xl font-bold tracking-widest uppercase transition-all shadow-sm hover:shadow-lg hover:shadow-ccd-danger/20 flex flex-col items-center justify-center gap-1 group"
              >
                <X className="w-6 h-6 group-hover:scale-110 transition-transform mb-1" />
                Quash
              </button>
              
              <button 
                onClick={() => handleVote('ABSTAIN')}
                className="flex-1 min-w-[150px] py-4 bg-white hover:bg-ccd-neutral text-ccd-neutral hover:text-white border-2 border-ccd-neutral/30 rounded-2xl font-bold tracking-widest uppercase transition-all shadow-sm hover:shadow-lg hover:shadow-ccd-neutral/20 flex flex-col items-center justify-center gap-1 group"
              >
                <Minus className="w-6 h-6 group-hover:scale-110 transition-transform mb-1" />
                Abstain
              </button>

              <button 
                onClick={() => handleVote('ADAPT')}
                className="flex-1 min-w-[150px] py-4 bg-white hover:bg-ccd-success text-ccd-success hover:text-white border-2 border-ccd-success/30 rounded-2xl font-bold tracking-widest uppercase transition-all shadow-sm hover:shadow-lg hover:shadow-ccd-success/20 flex flex-col items-center justify-center gap-1 group"
              >
                <Check className="w-6 h-6 group-hover:scale-110 transition-transform mb-1" />
                Adapt
              </button>
            </div>
          ) : (
            <div className="text-center bg-ccd-surface/30 p-6 rounded-2xl border border-ccd-accent/20">
              <div className="mx-auto w-12 h-12 bg-ccd-success/20 rounded-full flex items-center justify-center mb-3">
                <Check className="w-6 h-6 text-ccd-success" />
              </div>
              <h3 className="font-serif text-xl font-bold text-ccd-text">Your vote has been recorded</h3>
              <p className="text-sm text-ccd-text-sec mt-1">You voted to <strong className="uppercase">{voteType}</strong>.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
