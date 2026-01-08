'use client';

import { useState } from 'react';

const REASON_OPTIONS = [
    { id: 'taste', label: '味', emoji: '👅' },
    { id: 'amount', label: '量', emoji: '📏' },
    { id: 'temperature', label: '温度', emoji: '🌡️' },
    { id: 'variety', label: '飽き', emoji: '🔄' },
    { id: 'health', label: '体調', emoji: '💪' },
    { id: 'other', label: 'その他', emoji: '💭' },
] as const;

export type ReasonTag = typeof REASON_OPTIONS[number]['id'];

interface ReasonTagsProps {
    selected: ReasonTag[];
    onChange: (tags: ReasonTag[]) => void;
    disabled?: boolean;
}

export function ReasonTags({ selected, onChange, disabled }: ReasonTagsProps) {
    const [isExpanded, setIsExpanded] = useState(false);

    const toggleTag = (tagId: ReasonTag) => {
        if (disabled) return;

        if (selected.includes(tagId)) {
            onChange(selected.filter(t => t !== tagId));
        } else {
            onChange([...selected, tagId]);
        }
    };

    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-slate-700">
                    💬 気になった点
                    <span className="ml-2 text-xs text-slate-400">(任意・複数選択可)</span>
                </label>
                <button
                    type="button"
                    onClick={() => setIsExpanded(!isExpanded)}
                    className="text-xs text-sky-600 hover:text-sky-700"
                >
                    {isExpanded ? '閉じる' : '選択する'}
                </button>
            </div>

            {isExpanded && (
                <div className="flex flex-wrap gap-2">
                    {REASON_OPTIONS.map((option) => {
                        const isSelected = selected.includes(option.id);
                        return (
                            <button
                                key={option.id}
                                type="button"
                                onClick={() => toggleTag(option.id)}
                                disabled={disabled}
                                className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition ${isSelected
                                        ? 'bg-sky-100 text-sky-800 ring-2 ring-sky-300'
                                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                    } ${disabled ? 'cursor-not-allowed opacity-50' : ''}`}
                            >
                                <span>{option.emoji}</span>
                                <span>{option.label}</span>
                            </button>
                        );
                    })}
                </div>
            )}

            {/* 選択済みタグの表示（折りたたみ時） */}
            {!isExpanded && selected.length > 0 && (
                <div className="flex flex-wrap gap-1">
                    {selected.map((tagId) => {
                        const option = REASON_OPTIONS.find(o => o.id === tagId);
                        return option ? (
                            <span
                                key={tagId}
                                className="rounded-full bg-sky-50 px-2 py-0.5 text-xs text-sky-700"
                            >
                                {option.emoji} {option.label}
                            </span>
                        ) : null;
                    })}
                </div>
            )}
        </div>
    );
}

// ヘルパー関数: reasonTagsをJSON文字列に変換
export function serializeReasonTags(tags: ReasonTag[]): string | null {
    if (tags.length === 0) return null;
    return JSON.stringify(tags);
}

// ヘルパー関数: JSON文字列をreasonTagsに変換
export function parseReasonTags(json: string | null): ReasonTag[] {
    if (!json) return [];
    try {
        return JSON.parse(json) as ReasonTag[];
    } catch {
        return [];
    }
}
