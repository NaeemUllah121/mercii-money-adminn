import React, { useEffect, useState } from 'react';
import { integrationResultsAPI } from '../services/api';
import { useLanguage } from '../context/LanguageContext';
import {
  CheckCircle2, XCircle, Clock, AlertTriangle, RefreshCw, ExternalLink,
  Eye, FileText, Activity, Globe, Shield, CreditCard, Users
} from 'lucide-react';

interface IntegrationResult {
  id: string;
  customerId?: string;
  transactionId?: string;
  provider: string;
  providerRef: string;
  status: 'verified' | 'failed' | 'processing' | 'completed' | 'flagged';
  timestamp: string;
  summary: string;
  redactedSummary: string;
  errors: string[] | null;
  quickActions: string[];
}

interface BackgroundJob {
  id: string;
  type: string;
  status: 'running' | 'completed' | 'failed' | 'scheduled';
  startedAt?: string;
  completedAt?: string;
  scheduledFor?: string;
  progress: number;
  totalRecords: number;
  processedRecords: number;
  errors: number;
  nextRun: string;
}

interface Webhook {
  id: string;
  type: string;
  url: string;
  status: 'active' | 'inactive';
  lastTriggered: string;
  successCount: number;
  failureCount: number;
  lastError: string;
  signatureValid: boolean;
  idempotencyEnabled: boolean;
}

const IntegrationResults: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'kyc' | 'aml' | 'payments' | 'payouts' | 'jobs' | 'webhooks'>('kyc');
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    fetchData();
  }, [activeTab]);

  // Listen for custom event from sidebar
  useEffect(() => {
    const handleTabChange = (event: CustomEvent) => {
      const tab = event.detail as any;
      if (['kyc', 'aml', 'payments', 'payouts', 'jobs', 'webhooks'].includes(tab)) {
        setActiveTab(tab);
      }
    };

    window.addEventListener('setIntegrationTab', handleTabChange as EventListener);
    return () => {
      window.removeEventListener('setIntegrationTab', handleTabChange as EventListener);
    };
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      let response;
      switch (activeTab) {
        case 'kyc':
          response = await integrationResultsAPI.getKYCIntegrationResults();
          break;
        case 'aml':
          response = await integrationResultsAPI.getAMLIntegrationResults();
          break;
        case 'payments':
          response = await integrationResultsAPI.getPaymentsIntegrationResults();
          break;
        case 'payouts':
          response = await integrationResultsAPI.getPayoutsIntegrationResults();
          break;
        case 'jobs':
          response = await integrationResultsAPI.getBackgroundJobs();
          break;
        case 'webhooks':
          response = await integrationResultsAPI.getWebhooks();
          break;
      }
      setData(response.data || []);
    } catch (error) {
      console.error('Failed to fetch integration results:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'verified':
      case 'completed':
        return <CheckCircle2 className="w-4 h-4 text-green-600" />;
      case 'failed':
        return <XCircle className="w-4 h-4 text-red-600" />;
      case 'processing':
      case 'running':
        return <RefreshCw className="w-4 h-4 text-blue-600 animate-spin" />;
      case 'flagged':
        return <AlertTriangle className="w-4 h-4 text-orange-600" />;
      case 'scheduled':
        return <Clock className="w-4 h-4 text-gray-600" />;
      default:
        return <Clock className="w-4 h-4 text-gray-600" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'verified':
      case 'completed':
      case 'active':
        return 'text-green-600 bg-green-50';
      case 'failed':
      case 'inactive':
        return 'text-red-600 bg-red-50';
      case 'processing':
      case 'running':
        return 'text-blue-600 bg-blue-50';
      case 'flagged':
        return 'text-orange-600 bg-orange-50';
      case 'scheduled':
        return 'text-gray-600 bg-gray-50';
      default:
        return 'text-gray-600 bg-gray-50';
    }
  };

  const renderIntegrationResults = () => (
    <div className="space-y-3">
      {data.map((result: IntegrationResult) => (
        <div key={result.id} className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-3">
              {getStatusIcon(result.status)}
              <div>
                <p className="font-medium text-gray-900">{result.provider}</p>
                <p className="text-sm text-gray-500">Ref: {result.providerRef}</p>
              </div>
            </div>
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(result.status)}`}>
              {result.status}
            </span>
          </div>
          
          <div className="space-y-2">
            <p className="text-sm text-gray-700">{result.redactedSummary}</p>
            <p className="text-xs text-gray-500">{new Date(result.timestamp).toLocaleString()}</p>
            
            {result.errors && result.errors.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded p-2">
                <p className="text-xs text-red-700 font-medium mb-1">Errors:</p>
                {result.errors.map((error, index) => (
                  <p key={index} className="text-xs text-red-600">• {error}</p>
                ))}
              </div>
            )}
            
            <div className="flex gap-2 pt-2">
              {result.quickActions.map((action, index) => (
                <button
                  key={index}
                  className="px-3 py-1 text-xs bg-blue-50 text-blue-600 rounded hover:bg-blue-100 transition-colors"
                >
                  {action.replace('-', ' ')}
                </button>
              ))}
            </div>
          </div>
        </div>
      ))}
    </div>
  );

  const renderBackgroundJobs = () => (
    <div className="space-y-3">
      {data.map((job: BackgroundJob) => (
        <div key={job.id} className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-3">
              {getStatusIcon(job.status)}
              <div>
                <p className="font-medium text-gray-900">{job.type}</p>
                <p className="text-sm text-gray-500">ID: {job.id}</p>
              </div>
            </div>
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(job.status)}`}>
              {job.status}
            </span>
          </div>
          
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">Progress</span>
              <span className="font-medium">{job.processedRecords} / {job.totalRecords}</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-blue-600 h-2 rounded-full transition-all"
                style={{ width: `${job.progress}%` }}
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4 text-xs">
              <div>
                <span className="text-gray-500">Errors: </span>
                <span className={job.errors > 0 ? 'text-red-600 font-medium' : 'text-green-600'}>
                  {job.errors}
                </span>
              </div>
              <div>
                <span className="text-gray-500">Next Run: </span>
                <span className="text-gray-700">
                  {new Date(job.nextRun).toLocaleString()}
                </span>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );

  const renderWebhooks = () => (
    <div className="space-y-3">
      {data.map((webhook: Webhook) => (
        <div key={webhook.id} className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-3">
              <Globe className="w-4 h-4 text-blue-600" />
              <div>
                <p className="font-medium text-gray-900">{webhook.type}</p>
                <p className="text-sm text-gray-500">{webhook.url}</p>
              </div>
            </div>
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(webhook.status)}`}>
              {webhook.status}
            </span>
          </div>
          
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-500">Success Rate: </span>
              <span className="font-medium text-green-600">
                {webhook.successCount} / {webhook.successCount + webhook.failureCount}
              </span>
            </div>
            <div>
              <span className="text-gray-500">Last Triggered: </span>
              <span className="text-gray-700">
                {new Date(webhook.lastTriggered).toLocaleString()}
              </span>
            </div>
            <div>
              <span className="text-gray-500">Signature: </span>
              <span className={webhook.signatureValid ? 'text-green-600' : 'text-red-600'}>
                {webhook.signatureValid ? 'Valid' : 'Invalid'}
              </span>
            </div>
            <div>
              <span className="text-gray-500">Idempotency: </span>
              <span className={webhook.idempotencyEnabled ? 'text-green-600' : 'text-red-600'}>
                {webhook.idempotencyEnabled ? 'Enabled' : 'Disabled'}
              </span>
            </div>
          </div>
          
          {webhook.lastError && (
            <div className="mt-3 p-2 bg-red-50 border border-red-200 rounded">
              <p className="text-xs text-red-700">Last Error: {webhook.lastError}</p>
            </div>
          )}
        </div>
      ))}
    </div>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-6 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-gray-800">Integration Results</h2>
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-md font-medium capitalize">
              {activeTab}
            </span>
          </div>
        </div>

        {/* Content */}
        {activeTab === 'jobs' ? renderBackgroundJobs() : 
         activeTab === 'webhooks' ? renderWebhooks() : 
         renderIntegrationResults()}
      </div>
    </div>
  );
};

export default IntegrationResults;
