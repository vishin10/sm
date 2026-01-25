/**
 * KVExplorer Component
 * 
 * Displays all extracted KV pairs from a shift report in an accordion layout.
 * Features:
 * - Accordion sections from sections[]
 * - Lazy-loads KV rows on expand (with caching)
 * - Global search with pagination
 * - Safe value rendering (stringify objects, truncate long strings)
 * - Currency formatting for sales/amount fields
 */

import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ActivityIndicator,
    TextInput,
    FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, getThemeColors } from '../theme/colors';
import { useThemeStore } from '../store/themeStore';
import {
    shiftsApi,
    SectionInfo,
    KVPairItem,
    ShiftReportSectionResponse,
    ShiftReportSearchResponse,
} from '../api/shifts';

const PAGE_SIZE = 50;
const MAX_VALUE_LENGTH = 100;

interface KVExplorerProps {
    reportId: string;
    sections: SectionInfo[];
    totalFields: number;
}

// ============================================
// Helper: Safe value rendering
// ============================================
function formatValue(item: KVPairItem): string {
    const { value, valueType, path } = item;

    if (value === null || value === undefined) {
        return '—';
    }

    // Format currency for sales/amount fields
    const lowerPath = path.toLowerCase();
    if (
        valueType === 'number' &&
        (lowerPath.includes('sales') ||
            lowerPath.includes('amount') ||
            lowerPath.includes('total') ||
            lowerPath.includes('balance') ||
            lowerPath.includes('variance') ||
            lowerPath.includes('tax') ||
            lowerPath.includes('discount') ||
            lowerPath.includes('refund'))
    ) {
        const num = typeof value === 'string' ? parseFloat(value) : value;
        if (!isNaN(num)) {
            return new Intl.NumberFormat('en-US', {
                style: 'currency',
                currency: 'USD',
            }).format(num);
        }
    }

    // Handle objects/arrays
    if (typeof value === 'object') {
        const str = JSON.stringify(value);
        return str.length > MAX_VALUE_LENGTH
            ? str.substring(0, MAX_VALUE_LENGTH) + '…'
            : str;
    }

    // Handle strings
    if (typeof value === 'string') {
        return value.length > MAX_VALUE_LENGTH
            ? value.substring(0, MAX_VALUE_LENGTH) + '…'
            : value;
    }

    // Handle booleans
    if (typeof value === 'boolean') {
        return value ? 'Yes' : 'No';
    }

    // Handle numbers
    if (typeof value === 'number') {
        return value.toLocaleString();
    }

    return String(value);
}

function getTypeIcon(valueType: string): string {
    switch (valueType) {
        case 'number':
            return '#';
        case 'boolean':
            return '✓';
        case 'object':
        case 'array':
            return '{}';
        default:
            return 'T';
    }
}

// ============================================
// Component: Section Accordion
// ============================================
interface SectionAccordionProps {
    reportId: string;
    section: SectionInfo;
    themeColors: ReturnType<typeof getThemeColors>;
    cache: Map<string, { items: KVPairItem[]; hasMore: boolean }>;
    setCache: React.Dispatch<React.SetStateAction<Map<string, { items: KVPairItem[]; hasMore: boolean }>>>;
}

function SectionAccordion({
    reportId,
    section,
    themeColors,
    cache,
    setCache,
}: SectionAccordionProps) {
    const [expanded, setExpanded] = useState(false);
    const [loading, setLoading] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const [error, setError] = useState<string | null>(null);

    const cacheKey = section.name;
    const cachedData = cache.get(cacheKey);

    const toggleExpand = useCallback(async () => {
        if (expanded) {
            setExpanded(false);
            return;
        }

        setExpanded(true);

        // Use cache if available
        if (cachedData) {
            return;
        }

        // Fetch first page
        setLoading(true);
        setError(null);
        try {
            const response: ShiftReportSectionResponse = await shiftsApi.getShiftReportSection(
                reportId,
                section.name,
                1,
                PAGE_SIZE
            );

            setCache(prev => new Map(prev).set(cacheKey, {
                items: response.items,
                hasMore: response.page < response.totalPages,
            }));
            setCurrentPage(1);
        } catch (err: any) {
            console.error('Failed to load section:', err);
            setError('Failed to load section data');
        } finally {
            setLoading(false);
        }
    }, [expanded, cachedData, reportId, section.name, cacheKey, setCache]);

    const loadMore = useCallback(async () => {
        if (!cachedData || !cachedData.hasMore || loadingMore) return;

        setLoadingMore(true);
        try {
            const nextPage = currentPage + 1;
            const response: ShiftReportSectionResponse = await shiftsApi.getShiftReportSection(
                reportId,
                section.name,
                nextPage,
                PAGE_SIZE
            );
            setCache(prev => {
                const existing = prev.get(cacheKey);
                return new Map(prev).set(cacheKey, {
                    items: [...(existing?.items || []), ...response.items],
                    hasMore: response.page < response.totalPages,
                });
            });
            setCurrentPage(nextPage);
        } catch (err: any) {
            console.error('Failed to load more:', err);
        } finally {
            setLoadingMore(false);
        }
    }, [cachedData, loadingMore, currentPage, reportId, section.name, cacheKey, setCache]);

    const items = cachedData?.items || [];
    const hasMore = cachedData?.hasMore ?? false;

    return (
        <View style={styles.sectionContainer}>
            <TouchableOpacity
                style={[styles.sectionHeader, { backgroundColor: themeColors.card }]}
                onPress={toggleExpand}
                activeOpacity={0.7}
            >
                <View style={styles.sectionLeft}>
                    <Ionicons
                        name={expanded ? 'chevron-down' : 'chevron-forward'}
                        size={18}
                        color={themeColors.textSecondary}
                    />
                    <Text style={[styles.sectionName, { color: themeColors.textPrimary }]}>
                        {section.name}
                    </Text>
                </View>
                <View style={[styles.countBadge, { backgroundColor: themeColors.border }]}>
                    <Text style={[styles.countText, { color: themeColors.textSecondary }]}>
                        {section.count}
                    </Text>
                </View>
            </TouchableOpacity>

            {expanded && (
                <View style={[styles.sectionContent, { backgroundColor: themeColors.surface }]}>
                    {loading ? (
                        <View style={styles.loadingContainer}>
                            <ActivityIndicator size="small" color={colors.primary[500]} />
                            <Text style={[styles.loadingText, { color: themeColors.textSecondary }]}>
                                Loading...
                            </Text>
                        </View>
                    ) : error ? (
                        <Text style={[styles.errorText, { color: colors.semantic.error }]}>
                            {error}
                        </Text>
                    ) : items.length === 0 ? (
                        <Text style={[styles.emptyText, { color: themeColors.textSecondary }]}>
                            No fields in this section
                        </Text>
                    ) : (
                        <>
                            {items.map((item, idx) => (
                                <KVRow key={`${item.path}-${idx}`} item={item} themeColors={themeColors} />
                            ))}
                            {hasMore && (
                                <TouchableOpacity
                                    style={[styles.loadMoreButton, { borderColor: themeColors.border }]}
                                    onPress={loadMore}
                                    disabled={loadingMore}
                                >
                                    {loadingMore ? (
                                        <ActivityIndicator size="small" color={colors.primary[500]} />
                                    ) : (
                                        <Text style={[styles.loadMoreText, { color: colors.primary[500] }]}>
                                            Load more ({section.count - items.length} remaining)
                                        </Text>
                                    )}
                                </TouchableOpacity>
                            )}
                        </>
                    )}
                </View>
            )}
        </View>
    );
}

// ============================================
// Component: KV Row
// ============================================
interface KVRowProps {
    item: KVPairItem;
    themeColors: ReturnType<typeof getThemeColors>;
    showSection?: boolean;
}

function KVRow({ item, themeColors, showSection = false }: KVRowProps) {
    return (
        <View style={[styles.kvRow, { borderBottomColor: themeColors.border }]}>
            <View style={styles.kvPath}>
                {showSection && (
                    <Text style={[styles.kvSection, { color: colors.primary[500] }]}>
                        {item.section} ›
                    </Text>
                )}
                <Text style={[styles.kvPathText, { color: themeColors.textSecondary }]} numberOfLines={2}>
                    {item.displayPath || item.path}
                </Text>
            </View>
            <View style={styles.kvValueContainer}>
                <Text style={[styles.kvValue, { color: themeColors.textPrimary }]} numberOfLines={2}>
                    {formatValue(item)}
                </Text>
                <View style={[styles.typeBadge, { backgroundColor: themeColors.border }]}>
                    <Text style={[styles.typeText, { color: themeColors.textSecondary }]}>
                        {getTypeIcon(item.valueType)}
                    </Text>
                </View>
            </View>
        </View>
    );
}

// ============================================
// Component: Search Results
// ============================================
interface SearchResultsProps {
    reportId: string;
    query: string;
    themeColors: ReturnType<typeof getThemeColors>;
}

function SearchResults({ reportId, query, themeColors }: SearchResultsProps) {
    const [results, setResults] = useState<KVPairItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [hasMore, setHasMore] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const [total, setTotal] = useState(0);
    const [error, setError] = useState<string | null>(null);

    // Track request ID to ignore stale responses (race condition fix)
    const requestIdRef = useRef(0);

    // Trigger search when query changes
    React.useEffect(() => {
        if (query.length < 2) {
            setResults([]);
            setTotal(0);
            return;
        }

        // Increment request ID to invalidate any in-flight requests
        const currentRequestId = ++requestIdRef.current;

        const doSearch = async () => {
            setLoading(true);
            setError(null);
            try {
                const response: ShiftReportSearchResponse = await shiftsApi.searchShiftReport(
                    reportId,
                    query,
                    1,
                    PAGE_SIZE
                );
                // Ignore stale responses
                if (currentRequestId !== requestIdRef.current) return;

                setResults(response.items);
                setHasMore(response.page < response.totalPages);
                setCurrentPage(1);
                setTotal(response.total);
            } catch (err: any) {
                // Ignore errors from stale requests
                if (currentRequestId !== requestIdRef.current) return;
                console.error('Search failed:', err);
                setError('Search failed');
            } finally {
                // Only clear loading if this is still the current request
                if (currentRequestId === requestIdRef.current) {
                    setLoading(false);
                }
            }
        };

        // Debounce search
        const timeout = setTimeout(doSearch, 300);
        return () => clearTimeout(timeout);
    }, [query, reportId]);

    const loadMore = useCallback(async () => {
        if (!hasMore || loading) return;

        setLoading(true);
        try {
            const nextPage = currentPage + 1;
            const response: ShiftReportSearchResponse = await shiftsApi.searchShiftReport(
                reportId,
                query,
                nextPage,
                PAGE_SIZE
            );
            setResults(prev => [...prev, ...response.items]);
            setHasMore(response.page < response.totalPages);
            setCurrentPage(nextPage);
        } catch (err: any) {
            console.error('Load more failed:', err);
        } finally {
            setLoading(false);
        }
    }, [hasMore, loading, currentPage, reportId, query]);

    if (query.length < 2) {
        return null;
    }

    return (
        <View style={[styles.searchResults, { backgroundColor: themeColors.surface }]}>
            {loading && results.length === 0 ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="small" color={colors.primary[500]} />
                    <Text style={[styles.loadingText, { color: themeColors.textSecondary }]}>
                        Searching...
                    </Text>
                </View>
            ) : error ? (
                <Text style={[styles.errorText, { color: colors.semantic.error }]}>{error}</Text>
            ) : results.length === 0 ? (
                <Text style={[styles.emptyText, { color: themeColors.textSecondary }]}>
                    No matches found for "{query}"
                </Text>
            ) : (
                <>
                    <Text style={[styles.searchCount, { color: themeColors.textSecondary }]}>
                        Found {total} result{total !== 1 ? 's' : ''}
                    </Text>
                    {results.map((item, idx) => (
                        <KVRow key={`${item.path}-${idx}`} item={item} themeColors={themeColors} showSection />
                    ))}
                    {hasMore && (
                        <TouchableOpacity
                            style={[styles.loadMoreButton, { borderColor: themeColors.border }]}
                            onPress={loadMore}
                            disabled={loading}
                        >
                            {loading ? (
                                <ActivityIndicator size="small" color={colors.primary[500]} />
                            ) : (
                                <Text style={[styles.loadMoreText, { color: colors.primary[500] }]}>
                                    Load more results
                                </Text>
                            )}
                        </TouchableOpacity>
                    )}
                </>
            )}
        </View>
    );
}

// ============================================
// Main Component
// ============================================
export default function KVExplorer({ reportId, sections, totalFields }: KVExplorerProps) {
    const { theme } = useThemeStore();
    const themeColors = getThemeColors(theme);

    const [searchQuery, setSearchQuery] = useState('');
    const [sectionCache, setSectionCache] = useState<Map<string, { items: KVPairItem[]; hasMore: boolean }>>(new Map());

    // Reset cache when reportId changes (prevent cross-report data leakage)
    useEffect(() => {
        setSectionCache(new Map());
        setSearchQuery('');
    }, [reportId]);

    const isSearching = searchQuery.length >= 2;

    if (sections.length === 0 && totalFields === 0) {
        return (
            <View style={[styles.container, { backgroundColor: themeColors.background }]}>
                <View style={[styles.header, { backgroundColor: themeColors.surface }]}>
                    <Ionicons name="layers-outline" size={20} color={themeColors.textSecondary} />
                    <Text style={[styles.headerTitle, { color: themeColors.textPrimary }]}>
                        All Fields
                    </Text>
                </View>
                <View style={styles.emptyContainer}>
                    <Ionicons name="cube-outline" size={48} color={themeColors.textSecondary} />
                    <Text style={[styles.emptyTitle, { color: themeColors.textPrimary }]}>
                        No Fields Extracted
                    </Text>
                    <Text style={[styles.emptySubtitle, { color: themeColors.textSecondary }]}>
                        This report doesn't have any KV pairs
                    </Text>
                </View>
            </View>
        );
    }

    return (
        <View style={[styles.container, { backgroundColor: themeColors.background }]}>
            {/* Header */}
            <View style={[styles.header, { backgroundColor: themeColors.surface }]}>
                <Ionicons name="layers-outline" size={20} color={themeColors.textSecondary} />
                <Text style={[styles.headerTitle, { color: themeColors.textPrimary }]}>
                    All Fields
                </Text>
                <View style={[styles.totalBadge, { backgroundColor: themeColors.card }]}>
                    <Text style={[styles.totalText, { color: themeColors.textSecondary }]}>
                        {totalFields} fields
                    </Text>
                </View>
            </View>

            {/* Search Bar */}
            <View style={[styles.searchContainer, { backgroundColor: themeColors.surface }]}>
                <Ionicons name="search" size={18} color={themeColors.textSecondary} />
                <TextInput
                    style={[styles.searchInput, { color: themeColors.textPrimary }]}
                    placeholder="Search fields..."
                    placeholderTextColor={themeColors.textSecondary}
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    autoCapitalize="none"
                    autoCorrect={false}
                />
                {searchQuery.length > 0 && (
                    <TouchableOpacity onPress={() => setSearchQuery('')}>
                        <Ionicons name="close-circle" size={18} color={themeColors.textSecondary} />
                    </TouchableOpacity>
                )}
            </View>

            {/* Content */}
            {isSearching ? (
                <SearchResults reportId={reportId} query={searchQuery} themeColors={themeColors} />
            ) : (
                <View style={styles.sectionsContainer}>
                    {sections.map(section => (
                        <SectionAccordion
                            key={section.name}
                            reportId={reportId}
                            section={section}
                            themeColors={themeColors}
                            cache={sectionCache}
                            setCache={setSectionCache}
                        />
                    ))}
                </View>
            )}
        </View>
    );
}

// ============================================
// Styles
// ============================================
const styles = StyleSheet.create({
    container: {
        marginTop: 16,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        borderRadius: 12,
        marginBottom: 8,
        gap: 8,
    },
    headerTitle: {
        fontSize: 16,
        fontWeight: '600',
        flex: 1,
    },
    totalBadge: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
    },
    totalText: {
        fontSize: 12,
    },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        borderRadius: 12,
        marginBottom: 8,
        gap: 8,
    },
    searchInput: {
        flex: 1,
        fontSize: 15,
        padding: 0,
    },
    sectionsContainer: {
        gap: 4,
    },
    sectionContainer: {
        marginBottom: 4,
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 14,
        borderRadius: 10,
    },
    sectionLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    sectionName: {
        fontSize: 15,
        fontWeight: '500',
    },
    countBadge: {
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 8,
    },
    countText: {
        fontSize: 12,
        fontWeight: '500',
    },
    sectionContent: {
        padding: 12,
        marginTop: 2,
        borderRadius: 10,
    },
    loadingContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        gap: 8,
    },
    loadingText: {
        fontSize: 13,
    },
    errorText: {
        fontSize: 13,
        textAlign: 'center',
        padding: 16,
    },
    emptyText: {
        fontSize: 13,
        textAlign: 'center',
        padding: 16,
        fontStyle: 'italic',
    },
    emptyContainer: {
        alignItems: 'center',
        padding: 32,
    },
    emptyTitle: {
        fontSize: 16,
        fontWeight: '600',
        marginTop: 12,
    },
    emptySubtitle: {
        fontSize: 13,
        marginTop: 4,
    },
    kvRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: 10,
        borderBottomWidth: 1,
    },
    kvPath: {
        flex: 1,
        paddingRight: 12,
    },
    kvSection: {
        fontSize: 11,
        fontWeight: '600',
        marginBottom: 2,
    },
    kvPathText: {
        fontSize: 13,
    },
    kvValueContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        flexShrink: 0,
        maxWidth: '50%',
    },
    kvValue: {
        fontSize: 13,
        fontWeight: '500',
        textAlign: 'right',
        flexShrink: 1,
    },
    typeBadge: {
        width: 18,
        height: 18,
        borderRadius: 4,
        alignItems: 'center',
        justifyContent: 'center',
    },
    typeText: {
        fontSize: 10,
        fontWeight: '600',
    },
    loadMoreButton: {
        alignItems: 'center',
        padding: 12,
        marginTop: 8,
        borderWidth: 1,
        borderRadius: 8,
        borderStyle: 'dashed',
    },
    loadMoreText: {
        fontSize: 13,
        fontWeight: '500',
    },
    searchResults: {
        padding: 12,
        borderRadius: 10,
    },
    searchCount: {
        fontSize: 12,
        marginBottom: 8,
    },
});
