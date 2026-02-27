
function determineEntityContext(entityData) {
    let context = {
        entityType: 'individual', // default
        isDisapora: false
    };

    // Example logic to determine context
    if (entityData.occupation === 'politician' || entityData.isPublicFigure) {
        context.entityType = 'public_figure';
    }

    if (entityData.nationality !== entityData.countryOfResidence) {
        context.isDisapora = true;
    }

    return context;
}

function assessRisk(newsData, entityData = {}) {
    // Determine entity context automatically
    const entityContext = determineEntityContext(entityData);
    
    // Category weights for scoring calculation
    const CATEGORY_WEIGHTS = {
        terrorism: 5,
        financial_crime: 3,
        violent_crime: 2,
        organized_crime: 2,
        regulatory: 2,
        political: 1
    };

    // Risk thresholds per category
    const RISK_THRESHOLDS = {
        violent_crime: { low: 100, medium: 500 },
        terrorism: { low: 20, medium: 100 },
        regulatory: { low: 500, medium: 2000 },
        financial_crime: { low: 100, medium: 500 },
        political: { low: 10000, medium: 50000 },
        organized_crime: { low: 100, medium: 500 }
    };

    // Scoring thresholds
    const SCORE_THRESHOLDS = {
        PASS: 50,
        REVIEW: 200
    };

    const exposures = newsData.news_exposures;
    let totalScore = 0;
    let categoryAssessments = {};
    let qualitativeFlags = [];
    let highestRiskCategory = null;
    let maxCategoryRisk = 'LOW';

    // Assess each category
    for (const [categoryKey, categoryData] of Object.entries(exposures)) {
        const hits = categoryData.hits;
        const weight = CATEGORY_WEIGHTS[categoryKey] || 1;
        const thresholds = RISK_THRESHOLDS[categoryKey];
        
        // Calculate category score
        const categoryScore = hits * weight;
        totalScore += categoryScore;

        // Determine category risk level
        let riskLevel;
        if (hits <= thresholds.low) {
            riskLevel = 'LOW';
        } else if (hits <= thresholds.medium) {
            riskLevel = 'MEDIUM';
        } else {
            riskLevel = 'HIGH';
        }

        // Track highest risk category
        if (riskLevel === 'HIGH' || (riskLevel === 'MEDIUM' && maxCategoryRisk === 'LOW')) {
            highestRiskCategory = categoryKey;
            maxCategoryRisk = riskLevel;
        }

        // Store category assessment
        categoryAssessments[categoryKey] = {
            hits,
            weight,
            categoryScore,
            riskLevel,
            threshold_breached: riskLevel !== 'LOW'
        };

        // Check for qualitative review triggers
        if (categoryKey === 'terrorism' && hits > 0) {
            qualitativeFlags.push(`Terrorism exposure detected (${hits} hits)`);
        }
        
        if (categoryKey === 'financial_crime' && hits > 0) {
            qualitativeFlags.push(`Financial crime exposure detected (${hits} hits)`);
        }

        if (riskLevel === 'HIGH') {
            qualitativeFlags.push(`High risk in ${categoryKey.replace('_', ' ')} category`);
        }
    }

    // Determine overall risk decision
    let overallDecision;
    let recommendation;

    if (totalScore <= SCORE_THRESHOLDS.PASS) {
        overallDecision = 'PASS';
        recommendation = 'Low risk - proceed with standard processing';
    } else if (totalScore <= SCORE_THRESHOLDS.REVIEW) {
        overallDecision = 'REVIEW';
        recommendation = 'Medium risk - escalate for manual review';
    } else {
        overallDecision = 'FLAG';
        recommendation = 'High risk - immediate compliance escalation required';
    }

    // Override for qualitative triggers
    if (qualitativeFlags.length > 0 && overallDecision === 'PASS') {
        overallDecision = 'REVIEW';
        recommendation = 'Escalated due to qualitative risk factors';
    }

    // Context-based adjustments
    if (entityContext.entityType === 'public_figure' && categoryAssessments.political?.riskLevel === 'MEDIUM') {
        recommendation += ' (Note: Political exposure expected for public figures)';
    }

    if (entityContext.isDisapora && categoryAssessments.political?.hits > 0) {
        recommendation += ' (Note: Consider diaspora context for political exposure)';
    }

    // Return comprehensive assessment
    return {
        timestamp: newsData.timestamp,
        assessment: {
            total_score: totalScore,
            overall_decision: overallDecision,
            recommendation: recommendation,
            risk_summary: {
                highest_risk_category: highestRiskCategory,
                max_category_risk: maxCategoryRisk,
                total_hits: newsData.total_hits
            }
        },
        category_breakdown: categoryAssessments,
        qualitative_flags: qualitativeFlags,
        requires_manual_review: overallDecision !== 'PASS' || qualitativeFlags.length > 0,
        metadata: {
            entity_context: entityContext,
            entity_data: entityData,
            scoring_methodology: 'Category-weighted with qualitative overrides'
        }
    };
}

// Export for use in other modules
module.exports = {
    assessRisk,
};
