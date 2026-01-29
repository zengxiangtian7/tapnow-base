import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Icons } from '../Icons';
import { MODEL_REGISTRY, getModelConfig, saveModelConfig, ModelConfig, registerCustomModel, deleteModel, isCustomModel } from '../../services/geminiService';

interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    isDark: boolean;
}

// 全局配置 Key
const GLOBAL_BASE_URL_KEY = 'GLOBAL_BASE_URL';
const GLOBAL_API_KEY_KEY = 'GLOBAL_API_KEY';

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, isDark }) => {
    // 全局配置
    const [globalBaseUrl, setGlobalBaseUrl] = useState('');
    const [globalApiKey, setGlobalApiKey] = useState('');
    
    // 模型配置
    const [configs, setConfigs] = useState<Record<string, ModelConfig>>({});
    const [expandedModels, setExpandedModels] = useState<Set<string>>(new Set());
    const [searchTerm, setSearchTerm] = useState('');
    const [filterType, setFilterType] = useState<'all' | 'image' | 'video' | 'chat'>('all');
    
    // 测试连接状态
    const [testingModels, setTestingModels] = useState<Set<string>>(new Set());
    const [testResults, setTestResults] = useState<Record<string, 'success' | 'error' | null>>({});
    
    // 添加模型状态
    const [showAddModel, setShowAddModel] = useState(false);
    const [newModelName, setNewModelName] = useState('');
    const [newModelId, setNewModelId] = useState('');
    const [newModelType, setNewModelType] = useState<'IMAGE' | 'VIDEO'>('IMAGE');

    const configInputRef = useRef<HTMLInputElement>(null);

    // 加载配置
    useEffect(() => {
        if (isOpen) {
            // 加载全局配置
            setGlobalBaseUrl(localStorage.getItem(GLOBAL_BASE_URL_KEY) || '');
            setGlobalApiKey(localStorage.getItem(GLOBAL_API_KEY_KEY) || '');
            
            // 加载模型配置
            const newConfigs: Record<string, ModelConfig> = {};
            Object.keys(MODEL_REGISTRY).forEach(key => {
                newConfigs[key] = getModelConfig(key);
            });
            setConfigs(newConfigs);
        }
    }, [isOpen]);

    // 保存全局配置
    const saveGlobalConfig = () => {
        localStorage.setItem(GLOBAL_BASE_URL_KEY, globalBaseUrl);
        localStorage.setItem(GLOBAL_API_KEY_KEY, globalApiKey);
        
        // 更新所有模型的 baseUrl（除了特定模型）
        const excludeModels = ['Jimeng45', 'Jimeng41', 'Jimeng31'];
        Object.keys(MODEL_REGISTRY).forEach(key => {
            if (!excludeModels.some(ex => key.includes(ex))) {
                const config = configs[key] || {};
                if (!config.baseUrl && globalBaseUrl) {
                    updateConfig(key, 'baseUrl', globalBaseUrl);
                }
            }
        });
        
        // 触发全局配置更新事件，通知所有节点重新检查配置
        window.dispatchEvent(new CustomEvent('modelConfigUpdated', { detail: { modelName: '*' } }));
    };

    // 更新模型配置
    const updateConfig = (modelKey: string, field: keyof ModelConfig, value: string) => {
        setConfigs(prev => {
            const newConfig = { ...prev[modelKey], [field]: value };
            // 立即保存到 localStorage
            saveModelConfig(modelKey, newConfig);
            return { ...prev, [modelKey]: newConfig };
        });
    };

    // 切换展开状态
    const toggleExpand = (key: string) => {
        setExpandedModels(prev => {
            const newSet = new Set(prev);
            if (newSet.has(key)) {
                newSet.delete(key);
            } else {
                newSet.add(key);
            }
            return newSet;
        });
    };

    // 测试连接 - 带超时处理
    const testConnection = async (modelKey: string) => {
        setTestingModels(prev => new Set(prev).add(modelKey));
        setTestResults(prev => ({ ...prev, [modelKey]: null }));
        
        // 创建超时控制器
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10秒超时
        
        try {
            const config = configs[modelKey];
            const baseUrl = (config?.baseUrl || globalBaseUrl || '').replace(/\/$/, '');
            const apiKey = config?.key || globalApiKey;
            
            if (!baseUrl || !apiKey) {
                throw new Error('缺少 Base URL 或 API Key');
            }
            
            // 根据 endpoint 确定测试 URL
            const endpoint = config?.endpoint || '';
            let testUrl = `${baseUrl}/v1/models`;
            
            // 如果是 Gemini/Google 风格的 API，使用不同的测试方式
            if (endpoint.includes('v1beta') || endpoint.includes('generateContent')) {
                testUrl = `${baseUrl}/v1beta/models`;
            }
            
            const response = await fetch(testUrl, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'x-goog-api-key': apiKey, // Google API 格式
                    'Content-Type': 'application/json',
                },
                signal: controller.signal,
            });
            
            clearTimeout(timeoutId);
            
            // 200-299 状态码都算成功，401/403 说明连接通但认证问题
            if (response.ok || response.status === 401 || response.status === 403) {
                setTestResults(prev => ({ ...prev, [modelKey]: 'success' }));
            } else {
                setTestResults(prev => ({ ...prev, [modelKey]: 'error' }));
            }
        } catch (e: any) {
            clearTimeout(timeoutId);
            
            // 检查是否是超时
            if (e.name === 'AbortError') {
                console.warn(`测试 ${modelKey} 超时`);
            }
            
            // 检查是否是 Mixed Content 导致的失败 (虽然 catch 无法直接区分，但可以推测)
            const config = configs[modelKey];
            const originalBaseUrl = (config?.baseUrl || globalBaseUrl || '');
            
            if (e.message === 'Failed to fetch' || e.name === 'TypeError') {
                // 如果我们刚才进行了自动升级（原地址是 HTTP，但在 HTTPS 页面下测试）
                if (typeof window !== 'undefined' && window.location.protocol === 'https:' && originalBaseUrl.startsWith('http://')) {
                      console.warn('HTTPS upgrade failed for HTTP endpoint');
                      alert(`连接失败：\n1. 当前网站是 HTTPS 安全协议，浏览器禁止直接访问 HTTP 接口。\n2. 系统尝试自动升级为 HTTPS 连接，但对方服务器不支持 HTTPS 或握手失败。\n\n解决方案：\n👉 请更换支持 HTTPS 的 API 服务商（推荐）\n👉 或下载代码在本地 (localhost) 运行`);
                } else if (isMixedContent(originalBaseUrl)) {
                     console.warn('Mixed Content detected during connection test');
                     alert('连接失败：浏览器禁止在 HTTPS 网站中访问 HTTP 接口。请使用 HTTPS API 地址。');
                } else {
                     // 可能是 CORS
                     console.warn('CORS or Network error');
                     // 不弹窗，只显示红色错误图标
                }
            }

            // CORS 错误或网络错误
            setTestResults(prev => ({ ...prev, [modelKey]: 'error' }));
        } finally {
            setTestingModels(prev => {
                const newSet = new Set(prev);
                newSet.delete(modelKey);
                return newSet;
            });
        }
    };

    // 添加自定义模型
    const handleAddModel = () => {
        if (!newModelName || !newModelId) return;
        
        registerCustomModel(newModelName, {
            id: newModelId,
            name: newModelName,
            type: newModelType === 'IMAGE' ? 'IMAGE_GEN' : 'VIDEO_GEN_FORM',
            category: newModelType,
            defaultEndpoint: newModelType === 'IMAGE' ? '/v1/images/generations' : '/v1/videos'
        });
        
        setConfigs(prev => ({
            ...prev,
            [newModelName]: getModelConfig(newModelName)
        }));
        
        setShowAddModel(false);
        setNewModelName('');
        setNewModelId('');
        setExpandedModels(prev => new Set(prev).add(newModelName));
    };
    
    // 删除模型
    const handleDeleteModel = (key: string) => {
        const modelName = MODEL_REGISTRY[key]?.name || key;
        if (confirm(`确定要删除模型 "${modelName}" 吗？删除后将不再显示在模型选择列表中。`)) {
            deleteModel(key);
            setConfigs(prev => {
                const newConfigs = { ...prev };
                delete newConfigs[key];
                return newConfigs;
            });
            setExpandedModels(prev => {
                const newSet = new Set(prev);
                newSet.delete(key);
                return newSet;
            });
        }
    };

    // 导出配置
    const handleExport = () => {
        const exportData = {
            version: 2,
            timestamp: new Date().toISOString(),
            globalBaseUrl,
            globalApiKey,
            configs: Object.fromEntries(
                Object.entries(configs).filter(([_, v]) => v.key || v.baseUrl || v.modelId)
            )
        };
        
        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `flowgen-config-${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
    };

    // 导入配置
    const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const data = JSON.parse(event.target?.result as string);
                if (data.globalBaseUrl) setGlobalBaseUrl(data.globalBaseUrl);
                if (data.globalApiKey) setGlobalApiKey(data.globalApiKey);
                if (data.configs) {
                    Object.entries(data.configs).forEach(([key, config]) => {
                        saveModelConfig(key, config as ModelConfig);
                    });
                    // 重新加载
                    const newConfigs: Record<string, ModelConfig> = {};
                    Object.keys(MODEL_REGISTRY).forEach(key => {
                        newConfigs[key] = getModelConfig(key);
                    });
                    setConfigs(newConfigs);
                }
                alert('配置导入成功');
            } catch (err) {
                alert('导入失败：文件格式无效');
            }
        };
        reader.readAsText(file);
        e.target.value = '';
    };

    // 过滤模型列表
    const filteredModels = useMemo(() => {
        return Object.keys(MODEL_REGISTRY).filter(key => {
            const def = MODEL_REGISTRY[key];
            
            const matchesSearch = !searchTerm || 
                def.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                def.id.toLowerCase().includes(searchTerm.toLowerCase());
            
            const matchesType = filterType === 'all' || 
                (filterType === 'image' && def.category === 'IMAGE') ||
                (filterType === 'video' && def.category === 'VIDEO') ||
                (filterType === 'chat' && def.category === 'CHAT');
            
            return matchesSearch && matchesType;
        });
    }, [searchTerm, filterType, configs]);

    // 判断模型是否已配置
    const isConfigured = (key: string) => {
        const config = configs[key];
        return (config?.key || globalApiKey) && (config?.baseUrl || globalBaseUrl);
    };

    // 检查是否是混合内容（Mixed Content）风险
    const isMixedContent = (url: string) => {
        if (typeof window === 'undefined') return false;
        return window.location.protocol === 'https:' && url.toLowerCase().startsWith('http://');
    };

    // 样式
    const bgMain = isDark ? 'bg-[#0f0f11]' : 'bg-gray-50';
    const bgCard = isDark ? 'bg-[#18181b]' : 'bg-white';
    const borderColor = isDark ? 'border-[#27272a]' : 'border-gray-200';
    const textMain = isDark ? 'text-white' : 'text-gray-900';
    const textSub = isDark ? 'text-gray-400' : 'text-gray-500';
    const textMuted = isDark ? 'text-gray-600' : 'text-gray-400';
    const inputBg = isDark ? 'bg-[#0f0f11]' : 'bg-gray-50';

    if (!isOpen) return null;

    return (
        <div 
            className="fixed inset-0 z-[250] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
            onClick={onClose}
        >
            <div 
                className={`w-full max-w-3xl max-h-[90vh] rounded-2xl overflow-hidden shadow-2xl border ${bgCard} ${borderColor} flex flex-col animate-in zoom-in-95 duration-200`}
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className={`px-6 py-4 border-b ${borderColor} flex items-center justify-between shrink-0`}>
                    <h2 className={`text-lg font-bold ${textMain}`}>模型接口配置</h2>
                    <button 
                        onClick={onClose}
                        className={`p-2 rounded-lg transition-colors ${isDark ? 'hover:bg-white/5 text-gray-400' : 'hover:bg-gray-100 text-gray-500'}`}
                    >
                        <Icons.X size={18} />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto custom-scrollbar">
                    <div className="p-6 space-y-6">
                        
                        {/* ⚠️ 警告提示 */}
                        <div className={`p-4 rounded-xl border ${isDark ? 'bg-amber-500/10 border-amber-500/30' : 'bg-amber-50 border-amber-200'}`}>
                            <div className="flex items-start gap-3">
                                <div className={`shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${isDark ? 'bg-amber-500/20 text-amber-400' : 'bg-amber-100 text-amber-600'}`}>
                                    <Icons.AlertTriangle size={18} />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h4 className={`text-sm font-bold mb-1 ${isDark ? 'text-amber-400' : 'text-amber-700'}`}>
                                        ⚠️ 博主提醒：自接 API 平台有风险！
                                    </h4>
                                    <p className={`text-xs leading-relaxed ${isDark ? 'text-amber-300/80' : 'text-amber-600'}`}>
                                        很多小型 API 中转商可能会跑路，充值后血本无归。如果出图/出视频量大，建议使用大厂服务。
                                    </p>
                                    <div className={`mt-2 p-2 rounded-lg ${isDark ? 'bg-emerald-500/10 border border-emerald-500/30' : 'bg-emerald-50 border border-emerald-200'}`}>
                                        <p className={`text-xs ${isDark ? 'text-emerald-400' : 'text-emerald-700'}`}>
                                            <span className="font-bold">✅ 推荐：</span>
                                            <a href="https://xianchou.com" target="_blank" rel="noopener noreferrer" className="underline ml-1 hover:opacity-80">
                                                献丑AI (xianchou.com)
                                            </a>
                                            <span className="mx-1">—</span>
                                            <span>Banana Pro 4K 仅 0.2元/张，Sora 2 顶配仅 4积分/条</span>
                                        </p>
                                    </div>
                                    <p className={`text-[10px] mt-2 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                                        💡 提示：不同中转商的接口参数格式可能不同，如不兼容请参考 README 或用 AI 编辑器调整代码
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* 全局配置区域 */}
                        <div className="space-y-4">
                            {/* Global Base URL */}
                            <div className="space-y-2">
                                <label className={`text-xs font-medium uppercase tracking-wider ${textSub}`}>
                                    GLOBAL BASE URL（全局 API 地址）
                                </label>
                                <input
                                    type="text"
                                    value={globalBaseUrl}
                                    onChange={e => setGlobalBaseUrl(e.target.value)}
                                    onBlur={saveGlobalConfig}
                                    className={`w-full px-4 py-3 rounded-xl text-sm border ${borderColor} ${inputBg} ${textMain} outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50 transition-all`}
                                    placeholder="https://api.example.com"
                                />
                                <p className={`text-xs ${textMuted}`}>
                                    修改后将自动更新所有模型的 BASE URL（Jimeng 4.5、4.1、3.1 除外）
                                </p>
                            </div>

                            {/* Global API Key */}
                            <div className="space-y-2">
                                <label className={`text-xs font-medium uppercase tracking-wider ${textSub}`}>
                                    GLOBAL API KEY（可选，全局默认 KEY）
                                </label>
                                <input
                                    type="password"
                                    value={globalApiKey}
                                    onChange={e => setGlobalApiKey(e.target.value)}
                                    onBlur={saveGlobalConfig}
                                    className={`w-full px-4 py-3 rounded-xl text-sm border ${borderColor} ${inputBg} ${textMain} outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50 transition-all`}
                                    placeholder="sk-..."
                                />
                            </div>
                        </div>

                        {/* 分隔线 */}
                        <div className={`border-t ${borderColor}`}></div>

                        {/* 搜索和筛选 */}
                        <div className="flex items-center gap-3">
                            <div className={`flex-1 relative`}>
                                <Icons.Search size={16} className={`absolute left-3 top-1/2 -translate-y-1/2 ${textMuted}`} />
                                <input
                                    type="text"
                                    value={searchTerm}
                                    onChange={e => setSearchTerm(e.target.value)}
                                    className={`w-full pl-10 pr-4 py-2.5 rounded-xl text-sm border ${borderColor} ${inputBg} ${textMain} outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50 transition-all`}
                                    placeholder="搜索模型..."
                                />
                            </div>
                            <div className={`flex p-1 rounded-xl border ${borderColor} ${isDark ? 'bg-[#0f0f11]' : 'bg-gray-50'}`}>
                                {(['all', 'image', 'video'] as const).map(type => (
                                    <button
                                        key={type}
                                        onClick={() => setFilterType(type)}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                                            filterType === type
                                                ? 'bg-blue-500 text-white shadow-sm'
                                                : `${textSub} hover:text-white`
                                        }`}
                                    >
                                        {type === 'all' ? '全部' : type === 'image' ? '图像' : '视频'}
                                    </button>
                                ))}
                            </div>
                            <button
                                onClick={() => setShowAddModel(true)}
                                className={`px-3 py-2.5 rounded-xl text-xs font-medium border ${borderColor} ${textSub} hover:text-white hover:border-blue-500/50 transition-all flex items-center gap-1.5`}
                            >
                                <Icons.Plus size={14} /> 添加
                            </button>
                        </div>

                        {/* 模型列表 */}
                        <div className="space-y-3">
                            {filteredModels.map(key => {
                                const def = MODEL_REGISTRY[key];
                                const config = configs[key] || {};
                                const isExpanded = expandedModels.has(key);
                                const configured = isConfigured(key);
                                const testing = testingModels.has(key);
                                const testResult = testResults[key];
                                const isCustom = isCustomModel(key);

                                return (
                                    <div 
                                        key={key}
                                        className={`rounded-2xl border ${borderColor} overflow-hidden transition-all ${
                                            isExpanded ? (isDark ? 'bg-[#1a1a1f]' : 'bg-white') : ''
                                        }`}
                                    >
                                        {/* 模型头部 */}
                                        <div 
                                            className={`px-5 py-4 flex items-center justify-between cursor-pointer transition-colors ${
                                                isDark ? 'hover:bg-white/[0.02]' : 'hover:bg-gray-50'
                                            }`}
                                            onClick={() => toggleExpand(key)}
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className={`w-2.5 h-2.5 rounded-full ${
                                                    configured 
                                                        ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]' 
                                                        : (isDark ? 'bg-zinc-700' : 'bg-gray-300')
                                                }`} />
                                                <span className={`font-semibold ${textMain}`}>
                                                    {def.name}
                                                    {isCustom && <span className={`ml-2 text-[10px] font-normal ${textMuted}`}>(自定义)</span>}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase ${
                                                    def.category === 'IMAGE' 
                                                        ? (isDark ? 'bg-emerald-500/10 text-emerald-400' : 'bg-emerald-50 text-emerald-600')
                                                        : def.category === 'VIDEO'
                                                        ? (isDark ? 'bg-purple-500/10 text-purple-400' : 'bg-purple-50 text-purple-600')
                                                        : (isDark ? 'bg-blue-500/10 text-blue-400' : 'bg-blue-50 text-blue-600')
                                                }`}>
                                                    {def.category === 'IMAGE' ? 'Image' : def.category === 'VIDEO' ? 'Video' : 'Chat'}
                                                </span>
                                                
                                                {/* 删除按钮 */}
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); handleDeleteModel(key); }}
                                                    className={`p-1.5 rounded-lg transition-colors ${isDark ? 'hover:bg-red-500/10 text-zinc-500 hover:text-red-400' : 'hover:bg-red-50 text-gray-400 hover:text-red-500'}`}
                                                    title="删除模型"
                                                >
                                                    <Icons.Trash2 size={14} />
                                                </button>
                                                
                                                <Icons.ChevronRight 
                                                    size={16} 
                                                    className={`${textMuted} transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`} 
                                                />
                                            </div>
                                        </div>

                                        {/* 展开的配置区域 */}
                                        {isExpanded && (
                                            <div className={`px-5 pb-5 pt-2 space-y-4 border-t ${borderColor} animate-in slide-in-from-top-2 duration-200`}>
                                                {/* MODEL ID */}
                                                <div className="flex items-center gap-4">
                                                    <label className={`w-24 text-xs font-medium uppercase ${textSub} shrink-0 text-right`}>MODEL ID</label>
                                                    <input
                                                        type="text"
                                                        value={config.modelId || ''}
                                                        onChange={e => updateConfig(key, 'modelId', e.target.value)}
                                                        className={`flex-1 px-4 py-2.5 rounded-xl text-sm border ${borderColor} ${inputBg} ${textMain} outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50 transition-all`}
                                                        placeholder={def.id}
                                                    />
                                                </div>

                                                {/* API KEY */}
                                                <div className="flex items-center gap-4">
                                                    <label className={`w-24 text-xs font-medium uppercase ${textSub} shrink-0 text-right`}>API KEY</label>
                                                    <input
                                                        type="password"
                                                        value={config.key || ''}
                                                        onChange={e => updateConfig(key, 'key', e.target.value)}
                                                        className={`flex-1 px-4 py-2.5 rounded-xl text-sm border ${borderColor} ${inputBg} ${textMain} outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50 transition-all`}
                                                        placeholder={globalApiKey ? '使用全局 KEY' : 'sk-...'}
                                                    />
                                                </div>

                                                {/* BASE URL */}
                                                <div className="flex items-center gap-4">
                                                    <label className={`w-24 text-xs font-medium uppercase ${textSub} shrink-0 text-right`}>BASE URL</label>
                                                    <input
                                                        type="text"
                                                        value={config.baseUrl || ''}
                                                        onChange={e => updateConfig(key, 'baseUrl', e.target.value)}
                                                        className={`flex-1 px-4 py-2.5 rounded-xl text-sm border ${borderColor} ${inputBg} ${textMain} outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50 transition-all`}
                                                        placeholder={globalBaseUrl || 'https://api.example.com'}
                                                    />
                                                </div>

                                                {/* ENDPOINT */}
                                                <div className="flex items-center gap-4">
                                                    <label className={`w-24 text-xs font-medium uppercase ${textSub} shrink-0 text-right`}>ENDPOINT</label>
                                                    <input
                                                        type="text"
                                                        value={config.endpoint || ''}
                                                        onChange={e => updateConfig(key, 'endpoint', e.target.value)}
                                                        className={`flex-1 px-4 py-2.5 rounded-xl text-sm border ${borderColor} ${inputBg} ${textMain} outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50 transition-all`}
                                                        placeholder={def.defaultEndpoint || '/v1/chat/completions'}
                                                    />
                                                </div>

                                                {/* 测试连接按钮 */}
                                                <div className="flex items-center justify-end gap-3 pt-2">
                                                    {/* 测试结果提示 */}
                                                    {testResult && !testing && (
                                                        <span className={`text-xs font-medium ${
                                                            testResult === 'success' ? 'text-emerald-500' : 'text-red-500'
                                                        }`}>
                                                            {testResult === 'success' ? '连接成功' : '连接失败'}
                                                        </span>
                                                    )}
                                                    
                                                    <button
                                                        onClick={() => testConnection(key)}
                                                        disabled={testing}
                                                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium transition-all ${
                                                            testResult === 'success'
                                                                ? (isDark ? 'text-emerald-400 hover:bg-emerald-500/10' : 'text-emerald-600 hover:bg-emerald-50')
                                                                : testResult === 'error'
                                                                ? (isDark ? 'text-red-400 hover:bg-red-500/10' : 'text-red-600 hover:bg-red-50')
                                                                : `${textSub} hover:text-blue-500`
                                                        }`}
                                                    >
                                                        {testing ? (
                                                            <Icons.Loader2 size={14} className="animate-spin" />
                                                        ) : testResult === 'success' ? (
                                                            <Icons.Check size={14} />
                                                        ) : testResult === 'error' ? (
                                                            <Icons.AlertCircle size={14} />
                                                        ) : (
                                                            <Icons.Link size={14} />
                                                        )}
                                                        {testing ? '测试中...' : '测试连接'}
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}

                            {filteredModels.length === 0 && (
                                <div className={`text-center py-12 ${textMuted}`}>
                                    <Icons.Search size={32} className="mx-auto mb-3 opacity-50" />
                                    <p className="text-sm">未找到匹配的模型</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className={`px-6 py-4 border-t ${borderColor} flex items-center justify-between shrink-0`}>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => configInputRef.current?.click()}
                            className={`px-4 py-2 rounded-lg text-xs font-medium border ${borderColor} ${textSub} hover:text-white transition-all flex items-center gap-2`}
                        >
                            <Icons.Upload size={14} /> 导入配置
                        </button>
                        <button
                            onClick={handleExport}
                            className={`px-4 py-2 rounded-lg text-xs font-medium border ${borderColor} ${textSub} hover:text-white transition-all flex items-center gap-2`}
                        >
                            <Icons.Download size={14} /> 导出配置
                        </button>
                        <input type="file" ref={configInputRef} hidden accept=".json" onChange={handleImport} />
                    </div>
                    <div className={`text-xs ${textMuted}`}>
                        已配置 {Object.keys(configs).filter(k => isConfigured(k)).length} / {Object.keys(MODEL_REGISTRY).length} 个模型
                    </div>
                </div>
            </div>

            {/* 添加模型弹窗 */}
            {showAddModel && (
                <div 
                    className="fixed inset-0 z-[260] flex items-center justify-center bg-black/50"
                    onClick={() => setShowAddModel(false)}
                >
                    <div 
                        className={`w-full max-w-md p-6 rounded-2xl ${bgCard} border ${borderColor} shadow-2xl animate-in zoom-in-95 duration-200`}
                        onClick={e => e.stopPropagation()}
                    >
                        <h3 className={`text-lg font-bold mb-6 ${textMain}`}>添加自定义模型</h3>
                        
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <label className={`text-xs font-medium uppercase ${textSub}`}>模型名称</label>
                                <input
                                    type="text"
                                    value={newModelName}
                                    onChange={e => setNewModelName(e.target.value)}
                                    className={`w-full px-4 py-3 rounded-xl text-sm border ${borderColor} ${inputBg} ${textMain} outline-none focus:ring-2 focus:ring-blue-500/20`}
                                    placeholder="My Custom Model"
                                    autoFocus
                                />
                            </div>
                            
                            <div className="space-y-2">
                                <label className={`text-xs font-medium uppercase ${textSub}`}>模型 ID</label>
                                <input
                                    type="text"
                                    value={newModelId}
                                    onChange={e => setNewModelId(e.target.value)}
                                    className={`w-full px-4 py-3 rounded-xl text-sm border ${borderColor} ${inputBg} ${textMain} outline-none focus:ring-2 focus:ring-blue-500/20`}
                                    placeholder="custom-model-v1"
                                />
                            </div>
                            
                            <div className="space-y-2">
                                <label className={`text-xs font-medium uppercase ${textSub}`}>模型类型</label>
                                <div className="flex gap-2">
                                    {(['IMAGE', 'VIDEO'] as const).map(type => (
                                        <button
                                            key={type}
                                            onClick={() => setNewModelType(type)}
                                            className={`flex-1 py-3 rounded-xl text-sm font-medium border transition-all ${
                                                newModelType === type
                                                    ? 'border-blue-500 bg-blue-500/10 text-blue-500'
                                                    : `${borderColor} ${textSub}`
                                            }`}
                                        >
                                            {type === 'IMAGE' ? '图像生成' : '视频生成'}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                        
                        <div className="flex gap-3 mt-6">
                            <button
                                onClick={() => setShowAddModel(false)}
                                className={`flex-1 py-3 rounded-xl text-sm font-medium border ${borderColor} ${textSub} hover:text-white transition-all`}
                            >
                                取消
                            </button>
                            <button
                                onClick={handleAddModel}
                                disabled={!newModelName || !newModelId}
                                className={`flex-1 py-3 rounded-xl text-sm font-medium bg-blue-500 text-white hover:bg-blue-400 transition-all disabled:opacity-50 disabled:cursor-not-allowed`}
                            >
                                添加
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
