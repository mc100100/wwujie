
import React from 'react';
import MD3Select from './MD3Select';

interface ScriptStepProps {
  stylePreset: string;
  setStylePreset: (val: string) => void;
  scriptInput: string;
  setScriptInput: (val: string) => void;
  isAnalyzing: boolean;
  onAnalyze: () => void;
}

const ScriptStep: React.FC<ScriptStepProps> = ({
  stylePreset,
  setStylePreset,
  scriptInput,
  setScriptInput,
  isAnalyzing,
  onAnalyze,
}) => {
  const styleOptions = [
    { label: '日系萌系 (Kawaii)', value: '日系萌系 (Kawaii)，二次元动漫风格，极高饱和度，清新明亮，梦幻光影' },
    { label: '少年热血 (Shonen)', value: '少年热血 (Shonen)，动感十足，粗线条勾勒，强烈明暗对比，高帧率动态感' },
    { label: '少女浪漫 (Shoujo)', value: '少女浪漫 (Shoujo)，柔和光影，花瓣点缀，梦幻氛围，细腻纹理' },
    { label: '奇幻冒险', value: '奇幻冒险风格，宏大史诗感，绚丽色彩，丰富场景细节，魔法粒子效果' },
    { label: '日常治愈', value: '日常治愈风格，手绘质感，低饱和度，温馨柔和，吉卜力风格参考' },
    { label: '赛博朋克', value: '赛博朋克动漫风格，霓虹灯光，冷暖色调强烈对比，科技感细节，雨夜质感' },
    { label: '国风武侠 (射雕风格)', value: '国风武侠，写实动漫风格，厚涂质感，古朴色调，水墨晕染边缘' },
    { label: '国风仙侠 (诛仙风格)', value: '国风仙侠，飘逸唯美，仙气缭绕，淡雅色彩，发光符文效果' },
    { label: '国风古韵 (古装)', value: '国风古韵，传统工笔画质感，细腻线条，典雅庄重，织物纹理精细' },
    { label: '其他 (自定义)', value: '' }
  ];

  return (
    <div className="flex flex-col h-full gap-4 animate-in slide-in-from-bottom-4 duration-500">
      <div className="bg-gradient-to-r from-purple-500/10 to-indigo-500/10 p-5 rounded-3xl border border-purple-500/20">
        <div className="flex items-center gap-2 mb-3">
            <span className="text-lg">🎨</span>
            <span className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-wider">动漫风格选择</span>
        </div>
        <div className="relative z-50">
          <MD3Select
            value={stylePreset}
            options={styleOptions}
            onChange={setStylePreset}
            placeholder="请选择生成的视觉风格基调..."
            className="w-full"
          />
        </div>
        {/* 如果选择了自定义或其他，提供一个微型输入框补充细节 */}
        {(!styleOptions.some(opt => opt.value === stylePreset) || stylePreset === '') && (
            <input
              type="text"
              value={stylePreset}
              onChange={(e) => setStylePreset(e.target.value)}
              placeholder="或在此手动输入自定义风格描述词..."
              className="w-full mt-3 bg-white/50 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-2 text-xs outline-none focus:border-purple-500 text-slate-600 dark:text-slate-300 italic"
            />
        )}
      </div>
      
      <div className="flex-1 flex flex-col min-h-0 bg-slate-50 dark:bg-white/5 p-4 md:p-6 rounded-3xl border border-slate-200 dark:border-white/5">
        <h3 className="text-base md:text-lg font-black text-slate-800 dark:text-white mb-2 flex items-center gap-2">
          <i className="fa-solid fa-file-pen text-rose-500"></i> 剧本智能拆解
        </h3>
        <textarea
          className="flex-1 bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 text-sm md:text-base outline-none focus:border-rose-500 transition-all resize-none shadow-inner"
          placeholder="在此粘贴小说剧本内容，点击智能拆分即可自动提取资产并生成分镜描述词..."
          value={scriptInput}
          onChange={(e) => setScriptInput(e.target.value)}
        />
        <div className="flex justify-end mt-4 shrink-0">
          <button
            onClick={onAnalyze}
            disabled={isAnalyzing}
            className="px-6 md:px-10 py-3 md:py-4 bg-rose-600 hover:bg-rose-500 text-white rounded-2xl font-black shadow-xl flex items-center gap-3 transition-all active:scale-95 disabled:opacity-50 text-xs md:text-base"
          >
            {isAnalyzing ? <i className="fa-solid fa-spinner fa-spin"></i> : <i className="fa-solid fa-wand-magic-sparkles"></i>}开始拆分脚本
          </button>
        </div>
      </div>
    </div>
  );
};

export default ScriptStep;
