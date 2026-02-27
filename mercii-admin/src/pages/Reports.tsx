import React from 'react';
import { FileText, Download } from 'lucide-react';

const Reports: React.FC = () => {
  const handleDownload = async (reportTitle: string, reportType: string) => {
    try {
      // For now, create a sample CSV/PDF download
      const content = reportType === 'CSV' 
        ? 'Report Title,Date,Status\n' + reportTitle + ',' + new Date().toLocaleDateString() + ',Generated\n'
        : 'PDF Report: ' + reportTitle + '\nGenerated: ' + new Date().toLocaleDateString();
      
      const blob = new Blob([content], { type: reportType === 'CSV' ? 'text/csv' : 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${reportTitle.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.${reportType.toLowerCase()}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Download failed:', error);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
        <h3 className="text-sm font-semibold text-gray-800 mb-4">Available Reports</h3>
        <div className="space-y-3">
          {[
            { title: 'Daily Reconciliation Report', desc: 'Transaction reconciliation with variance analysis', type: 'CSV' },
            { title: 'KYC Verification Summary', desc: 'All KYC verifications status and outcomes', type: 'PDF' },
            { title: 'MLRO Compliance Report', desc: 'MLRO flags, approvals and rejections', type: 'PDF' },
            { title: 'Transaction Volume Report', desc: 'Daily/Monthly transaction volumes and trends', type: 'CSV' },
            { title: 'User Activity Report', desc: 'Customer registrations, logins and activity', type: 'CSV' },
            { title: 'Audit Trail Export', desc: 'Complete audit log export for compliance', type: 'CSV' },
          ].map((report, i) => (
            <div key={i} className="flex items-center justify-between p-4 border border-gray-100 rounded-xl hover:bg-gray-50 transition-colors card-animate">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
                  <FileText size={18} className="text-blue-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-800">{report.title}</p>
                  <p className="text-xs text-gray-400">{report.desc}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs px-2 py-1 bg-gray-100 text-gray-500 rounded font-mono">{report.type}</span>
                <button 
                  onClick={() => handleDownload(report.title, report.type)}
                  className="p-2 rounded-lg hover:bg-blue-50 text-gray-400 hover:text-blue-600 transition-colors"
                >
                  <Download size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Reports;
