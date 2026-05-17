# Bob Integration Guide for Bob on Call

This document describes how IBM Bob is integrated throughout the Bob on Call application.

> **📊 For detailed usage examples, metrics, and real-world scenarios, see [BOB_USAGE_REPORT.md](./BOB_USAGE_REPORT.md)**

## Overview

Bob on Call is deeply integrated with IBM Bob's Triage Partner mode to provide AI-powered incident response assistance at every stage of the on-call workflow.

## Bob Integration Points

### 1. Alert Translation (`/api/av-triage`)
**What it does:** Converts raw monitoring alerts into structured, actionable triage briefs.

**Bob's role:**
- Translates technical alert language into plain English
- Maps alerts to likely affected services and files
- Surfaces relevant recent commits
- Generates first three response checks
- Assesses severity and confidence

**API Endpoint:** `POST /api/av-triage`

**Bob Commands:**
- `/triage-alert <raw-alert-text>` - Quick triage from command palette

### 2. Deep Incident Analysis (`/api/ai-analyze`)
**What it does:** Provides root cause hypothesis and detailed investigation guidance.

**Bob's role:**
- Generates root cause hypothesis with confidence level
- Maps dependency chains and service relationships
- References similar historical incidents
- Creates ordered investigation path with time estimates
- Assesses rollback risks
- Estimates customer impact

**API Endpoint:** `POST /api/ai-analyze`

**Bob Commands:**
- `/analyze-incident <incident-id-or-title>` - Deep dive analysis

**UI Integration:** "Ask Bob for Deep Analysis" button in Shift Brain panel

### 3. Mitigation Strategies (`/api/ai-mitigation`)
**What it does:** Suggests immediate, short-term, and long-term mitigation options.

**Bob's role:**
- Provides 0-5 minute immediate actions with commands
- Suggests 5-30 minute short-term fixes
- Recommends long-term solutions with effort estimates
- Generates rollback procedures
- Creates communication templates
- Defines success criteria

**API Endpoint:** `POST /api/ai-mitigation`

**Bob Commands:**
- `/suggest-mitigation <incident-description>` - Get mitigation strategies

**UI Integration:** "Get Mitigation Strategies" button in Shift Brain panel

### 4. Shift Handoff Generation
**What it does:** Creates structured end-of-shift handoff documents.

**Bob's role:**
- Summarizes shift activity
- Prioritizes critical incidents
- Documents investigation status
- Lists mitigation actions taken
- Recommends next steps
- Formats for easy consumption

**Bob Commands:**
- `/generate-handoff [incident-ids...]` - Generate handoff document

**UI Integration:** Handoff Generator panel with incident selection

### 5. Regression Detection
**What it does:** Compares PR diffs against active incidents to detect regression risks.

**Bob's role:**
- Calculates overlap scores with active incidents
- Identifies code areas that intersect with symptoms
- Assesses risk levels with justification
- Recommends pre-merge validation
- Suggests monitoring metrics

**Bob Commands:**
- `/compare-regression <pr-url-or-diff>` - Analyze regression risk

**UI Integration:** Regression Radar panel

### 6. Metric Explanation
**What it does:** Explains monitoring metrics and alerts in plain language.

**Bob Commands:**
- `/explain-metric <metric-name-or-alert-text>` - Get metric explanation

## Bob Action Logging

All Bob activities are logged in the "Bob actions" panel with:
- **Category icons** for visual identification
- **Color-coded borders** by action type
- **Timestamps** for audit trail
- **Detailed descriptions** of what Bob did

### Action Categories:
- 🔄 **Translation** - Alert to brief conversion
- 🔍 **Analysis** - Deep investigation work
- 💡 **Mitigation** - Strategy generation
- ⚡ **Action** - Specific Bob actions taken
- 📝 **Note** - Investigation notes
- 📋 **Handoff** - Shift handoff generation
- 🗂️ **Context** - Repository context scanning
- 🛡️ **Fallback** - Local fallback used
- ⚠️ **Error** - Error conditions

## Configuration

### Environment Variables

```bash
# IBM Bob Configuration (Primary)
IBM_BOB_API_URL=https://your-bob-endpoint.example
IBM_BOB_API_KEY=your_bob_token
IBM_BOB_MODE=triage-partner
IBM_BOB_PROJECT_ID=optional_project_id

# Model Fallback (Secondary)
QWEN_API_KEY=your_qwen_key
QWEN_MODEL=qwen-plus
QWEN_BASE_URL=https://dashscope-intl.aliyuncs.com/compatible-mode/v1

# OpenRouter Fallback (Tertiary)
OPENROUTER_API_KEY=your_openrouter_key
OPENROUTER_MODEL=qwen/qwen3.6-plus

# Database (Optional)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_key
```

### Bob Mode Configuration

The Triage Partner mode is defined in `.bob/custom_modes.yaml`:

```yaml
customModes:
  - slug: triage-partner
    name: Triage Partner
    description: Real-time on-call incident triage
    roleDefinition: >-
      You are IBM Bob acting as an on-call triage engineer's AI partner.
    whenToUse: >-
      Use this mode when analyzing production alerts, creating shift re-briefs,
      investigating regressions, or generating end-of-shift handoffs.
```

### Bob Rules

Bob follows specific rules defined in `.bob/rules-triage-partner/`:

1. **Response Contract** (`01-response-contract.md`) - JSON structure for triage responses
2. **Investigation Guidance** (`02-investigation-guidance.md`) - Investigation best practices
3. **Handoff Quality** (`03-handoff-quality.md`) - Handoff document standards

## Bob Commands Reference

All Bob commands are defined in `.bob/commands/`:

| Command | Purpose | Argument |
|---------|---------|----------|
| `/triage-alert` | Translate raw alert | `<raw-alert-text>` |
| `/analyze-incident` | Deep analysis | `<incident-id-or-title>` |
| `/generate-handoff` | Create handoff | `[incident-ids...]` |
| `/compare-regression` | Check PR risk | `<pr-url-or-diff>` |
| `/suggest-mitigation` | Get strategies | `<incident-description>` |
| `/explain-metric` | Explain metric | `<metric-name-or-alert>` |

## Fallback Behavior

Bob on Call implements a three-tier fallback system:

1. **Primary:** IBM Bob API (when configured)
2. **Secondary:** Qwen/OpenRouter models (when configured)
3. **Tertiary:** Local triage playbook (always available)

This ensures the app remains functional even without external AI services.

## UI Integration Patterns

### Status Indicators
The header shows Bob's connection status:
- "IBM Bob connected" - Primary system active
- "Model backup ready" - Fallback available
- "Local fallback ready" - Always shown

### Interactive Features
- **Buttons** trigger Bob analysis on demand
- **Panels** display Bob's structured responses
- **Log rail** shows Bob's real-time activity
- **Visual feedback** indicates when Bob is thinking

### Response Visualization
Bob's responses are displayed in:
- **Gradient panels** for visual distinction
- **Structured sections** for easy scanning
- **Collapsible views** to manage screen space
- **Color-coded elements** for quick identification

## Best Practices

### For Users
1. **Start with Alert Translator** for initial triage
2. **Use Deep Analysis** when investigation stalls
3. **Get Mitigation Strategies** before making changes
4. **Generate Handoffs** at shift end
5. **Check Regression Radar** before merging PRs

### For Developers
1. **Always provide fallback responses** in API handlers
2. **Log all Bob actions** for visibility
3. **Use structured JSON** for Bob responses
4. **Handle errors gracefully** with local fallbacks
5. **Test without external services** to verify fallbacks

## Monitoring Bob Integration

Track Bob's effectiveness through:
- **Action log** - See what Bob is doing
- **Status indicators** - Verify connectivity
- **Response times** - Monitor performance
- **Fallback usage** - Identify configuration issues
- **User feedback** - Gather improvement ideas

## Troubleshooting

### Bob not responding
1. Check `IBM_BOB_API_URL` and `IBM_BOB_API_KEY`
2. Verify network connectivity
3. Check Bob action log for errors
4. Confirm fallback is working

### Unexpected responses
1. Review `.bob/rules-triage-partner/` rules
2. Check prompt construction in API handlers
3. Verify JSON response parsing
4. Test with local fallback for comparison

### Performance issues
1. Monitor API response times
2. Check for rate limiting
3. Consider caching strategies
4. Review log volume

## Additional Resources

- **[BOB_USAGE_REPORT.md](./BOB_USAGE_REPORT.md)** - Comprehensive usage report with:
  - Real-world usage examples and workflows
  - Quantitative impact metrics (85% faster MTTU, 67% faster MTTM)
  - Complete command demonstrations with sample outputs
  - Integration benefits and ROI analysis
  - Fallback system statistics
  - Action logging examples

## Future Enhancements

Potential Bob integration improvements:
- Real-time incident correlation
- Automated runbook generation
- Historical incident learning
- Team collaboration features
- Slack/Teams integration
- Custom alert templates
- Multi-language support
- Voice interface for hands-free operation