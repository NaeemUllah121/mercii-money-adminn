import React, { useState, useEffect } from 'react';
import { Menu, Search, Bell, Globe, Eye, Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { notificationsAPI } from '../services/api';

interface TopBarProps {
  onMenuToggle: () => void;
  pageTitle: string;
}

const languages = [
    { code: 'EN', name: 'English', flag: '🇬🇧' },
    { code: 'ES', name: 'Spanish', flag: '🇪🇸' },
    { code: 'FR', name: 'French', flag: '🇫🇷' },
    { code: 'DE', name: 'German', flag: '🇩🇪' },
    { code: 'IT', name: 'Italian', flag: '🇮🇹' },
    { code: 'PT', name: 'Portuguese', flag: '🇵🇹' },
    { code: 'HI', name: 'Hindi', flag: '🇮🇳' },
    { code: 'AR', name: 'Arabic', flag: '🇸🇦' },
    { code: 'ZH', name: 'Chinese', flag: '🇨🇳' },
    { code: 'JA', name: 'Japanese', flag: '🇯🇵' },
  { code: 'RU', name: 'Russian', flag: '🇷🇺' },
];

const TopBar: React.FC<TopBarProps> = ({ onMenuToggle, pageTitle }) => {
  const { user } = useAuth();
  const { t, currentLang, setLanguage } = useLanguage();
  const [searchQuery, setSearchQuery] = useState('');
  // const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showLangDropdown, setShowLangDropdown] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [languageSearchQuery, setLanguageSearchQuery] = useState('');
  const [filteredLanguages, setFilteredLanguages] = useState<any[]>([]);

  // Initialize filtered languages
  useEffect(() => {
    setFilteredLanguages(languages);
  }, []);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    fetchNotifications();
  }, []);

  const fetchNotifications = async () => {
    try {
      const response = await notificationsAPI.getRealNotifications();
      setNotifications(response.data.notifications || []);
      setUnreadCount(response.data.unreadCount || 0);
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    }
  };

  // Filter languages based on search query
  useEffect(() => {
    const filtered = languages.filter(lang => 
      lang.name.toLowerCase().includes(languageSearchQuery.toLowerCase()) ||
      lang.code.toLowerCase().includes(languageSearchQuery.toLowerCase())
    );
    setFilteredLanguages(filtered);
  }, [languageSearchQuery]);

  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    if (query.length < 2) {
      // setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      // Search functionality disabled for now
      // TODO: Re-enable when search results display is implemented
    } catch (error) {
      console.error('Search failed:', error);
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <>
      {/* Viewer Mode Notification */}
      {user?.role === 'viewer' && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 sm:px-6 py-2">
          <div className="flex items-center gap-2 text-amber-800">
            <Eye size={16} />
            <span className="text-sm font-medium">
              {t('viewer_mode')}
            </span>
          </div>
        </div>
      )}

      <header className="bg-white border-b border-gray-200 h-16 flex items-center justify-between px-4 lg:px-6 sticky top-0 z-30">
        {/* Left Section */}
        <div className="flex items-center gap-4">
          {/* Menu Toggle */}
          <button
            onClick={onMenuToggle}
            className="p-2 rounded-lg hover:bg-gray-100 text-gray-600 transition-colors lg:hidden"
          >
            <Menu size={20} />
          </button>

          {/* Page Title */}
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-semibold text-gray-900 truncate">{pageTitle}</h1>
          </div>
        </div>

        {/* Right Section */}
        <div className="flex items-center gap-2 sm:gap-4">
          {/* Search Bar - Hidden on mobile, visible on larger screens */}
          <div className="hidden sm:flex items-center relative max-w-xs">
            <Search size={18} className="absolute left-3 text-gray-400" />
            <input
              type="text"
              placeholder={t('search_placeholder')}
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              className="pl-10 pr-4 py-2 w-full bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
            {isSearching && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <Loader2 size={16} className="animate-spin text-blue-600" />
              </div>
            )}
          </div>

          {/* Language */}
          <div className="relative">
            <button 
              onClick={() => setShowLangDropdown(!showLangDropdown)}
              className="flex items-center gap-1 p-2 rounded-lg hover:bg-gray-100 text-gray-600 transition-colors"
            >
              <Globe size={18} className="sm:hidden" />
              <Globe size={20} className="hidden sm:block" />
              <span className="text-xs font-medium hidden sm:inline">{currentLang.toUpperCase()}</span>
            </button>
            {showLangDropdown && (
              <div className="absolute top-full mt-2 right-0 bg-white border border-gray-200 rounded-lg shadow-lg z-50 w-80 max-w-[calc(100vw-2rem)]">
                {/* Language Search Bar */}
                <div className="p-3 border-b border-gray-100">
                  <div className="relative">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      placeholder={t('search_language')}
                      value={languageSearchQuery}
                      onChange={(e) => setLanguageSearchQuery(e.target.value)}
                      className="pl-9 pr-3 py-2 w-full text-sm bg-gray-50 border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    />
                  </div>
                </div>
                {/* Language List */}
                <div className="max-h-64 overflow-y-auto">
                  {filteredLanguages.map((lang) => (
                    <button
                      key={lang.code}
                      onClick={() => {
                        setLanguage(lang.code.toLowerCase());
                        setShowLangDropdown(false);
                        setLanguageSearchQuery('');
                      }}
                      className="w-full px-4 py-2 text-left hover:bg-gray-50 flex items-center gap-2 text-sm"
                    >
                      <span>{lang.flag}</span>
                      <span>{lang.name}</span>
                      <span className="text-xs text-gray-500">({lang.code})</span>
                      {currentLang.toLowerCase() === lang.code.toLowerCase() && (
                        <span className="ml-auto text-blue-600">✓</span>
                      )}
                    </button>
                  ))}
                  {filteredLanguages.length === 0 && (
                    <div className="px-4 py-3 text-sm text-gray-500 text-center">
                      No languages found
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Notifications */}
          <div className="relative">
            <button 
              onClick={() => setShowNotifications(!showNotifications)}
              className="relative p-2 rounded-lg hover:bg-gray-100 text-gray-600 transition-colors"
            >
              <Bell size={18} className="sm:hidden" />
              <Bell size={20} className="hidden sm:block" />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full animate-pulse-dot" />
              )}
            </button>
            {showNotifications && (
              <div className="absolute top-full mt-2 right-0 bg-white border border-gray-200 rounded-lg shadow-lg z-50 w-80 max-w-[calc(100vw-2rem)]">
                <div className="p-3 border-b border-gray-100">
                  <h3 className="text-sm font-semibold text-gray-800">Notifications</h3>
                </div>
                <div className="max-h-64 overflow-y-auto">
                  {notifications.map((notif) => (
                    <div key={notif.id} className={`p-3 hover:bg-gray-50 border-b border-gray-100 last:border-b-0 ${!notif.read ? 'bg-blue-50' : ''}`}>
                      <div className="flex items-start gap-3">
                        <div className={`w-2 h-2 rounded-full mt-2 ${!notif.read ? 'bg-blue-600' : 'bg-gray-300'}`} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-800 truncate">{notif.title}</p>
                          <p className="text-xs text-gray-600 line-clamp-2">{notif.message}</p>
                          <p className="text-xs text-gray-400 mt-1">{notif.time}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="p-2 border-t border-gray-100">
                  <button className="text-xs text-blue-600 hover:text-blue-700 font-medium">Mark all as read</button>
                </div>
              </div>
            )}
          </div>

          {/* User */}
          <div className="flex items-center gap-2 ml-2 pl-2 border-l border-gray-200">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
              <span className="text-white text-xs font-bold">
                {user?.firstName?.charAt(0)}{user?.lastName?.charAt(0)}
              </span>
            </div>
            <div className="hidden sm:block">
              <p className="text-sm font-medium text-gray-900 truncate">
                {user?.firstName} {user?.lastName}
              </p>
              <p className="text-xs text-gray-500 truncate capitalize">
                {user?.role || 'Admin'}
              </p>
            </div>
          </div>
        </div>
      </header>
    </>
  );
};

export default TopBar;
