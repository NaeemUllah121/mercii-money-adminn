import React from 'react';
import { HelpCircle, MessageSquare, Book, ExternalLink } from 'lucide-react';

const Support: React.FC = () => {
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[
          { icon: MessageSquare, title: 'Contact Support', desc: 'Reach out to our team for help', action: 'Open Ticket', color: 'blue' },
          { icon: Book, title: 'Documentation', desc: 'Read the admin panel documentation', action: 'View Docs', color: 'indigo' },
          { icon: HelpCircle, title: 'FAQ', desc: 'Frequently asked questions', action: 'View FAQ', color: 'purple' },
        ].map((item, i) => {
          const Icon = item.icon;
          return (
            <div key={i} className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm card-animate hover:shadow-md transition-shadow">
              <div className={`w-12 h-12 rounded-xl bg-${item.color}-50 flex items-center justify-center mb-4`}>
                <Icon size={22} className={`text-${item.color}-600`} />
              </div>
              <h3 className="text-sm font-semibold text-gray-800 mb-1">{item.title}</h3>
              <p className="text-xs text-gray-400 mb-4">{item.desc}</p>
              <button className={`text-sm font-medium text-${item.color}-600 hover:text-${item.color}-700 flex items-center gap-1 transition-colors`}>
                {item.action} <ExternalLink size={14} />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default Support;
