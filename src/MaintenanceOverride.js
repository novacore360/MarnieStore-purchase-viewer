// MaintenanceOverride.js
// ============================================================
// 🔧 MAINTENANCE MODE CONTROL
// Set MAINTENANCE_ENABLED to true to show maintenance screen
// Set MAINTENANCE_ENABLED to false to hide maintenance screen
// ============================================================

import React from 'react';
import styled, { keyframes } from 'styled-components';

// ─── TOGGLE THIS TO ENABLE/DISABLE MAINTENANCE MODE ──────────
const MAINTENANCE_ENABLED = true; // <-- Change to true to activate
// ──────────────────────────────────────────────────────────────

// Customize your maintenance message here
const MAINTENANCE_CONFIG = {
  icon: '🔧',
  title: '🛠️ Under Maintenance',
  subtitle: 'We are currently performing upgrades to enhance customer privacy..',
  description: 'Please check back in an hour. We apologize for the inconvenience.',
  estimatedTime: '⏳ Estimated downtime: 5 hours',
  progressLabel: 'Upgrading Security...',
  progressPercent: 65,
};

// ─── STYLED COMPONENTS ──────────────────────────────────────────

const pulse = keyframes`
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.1); }
`;

const fadeIn = keyframes`
  from { opacity: 0; transform: scale(0.95); }
  to { opacity: 1; transform: scale(1); }
`;

const shimmerLine = keyframes`
  0%, 100% { transform: translateX(-100%); }
  50% { transform: translateX(100%); }
`;

const progressShimmer = keyframes`
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
`;

const float = keyframes`
  0%, 100% { transform: translateY(0px); }
  50% { transform: translateY(-10px); }
`;

const rotate = keyframes`
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
`;

const Overlay = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 999999;
  background: linear-gradient(135deg, #0f0c29 0%, #302b63 50%, #24243e 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  animation: ${fadeIn} 0.6s ease;
`;

const Content = styled.div`
  text-align: center;
  padding: 48px 40px;
  max-width: 540px;
  width: 100%;
  background: rgba(255, 255, 255, 0.03);
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
  border-radius: 32px;
  border: 1px solid rgba(255, 255, 255, 0.06);
  box-shadow: 0 25px 80px rgba(0, 0, 0, 0.6);
  position: relative;
  overflow: hidden;
  margin: 20px;

  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: -50%;
    right: -50%;
    height: 2px;
    background: linear-gradient(90deg, transparent, #6c5ce7, #a29bfe, #6c5ce7, transparent);
    animation: ${shimmerLine} 3s ease-in-out infinite;
  }
`;

const IconWrapper = styled.div`
  font-size: 80px;
  margin-bottom: 20px;
  display: block;
  animation: ${pulse} 2s ease-in-out infinite;
`;

const AnimatedIcon = styled.div`
  display: inline-block;
  animation: ${float} 3s ease-in-out infinite;
`;

const Title = styled.h1`
  font-size: 34px;
  font-weight: 700;
  color: #ffffff;
  margin: 0 0 12px 0;
  letter-spacing: -0.5px;
  background: linear-gradient(135deg, #ffffff, #a29bfe);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
`;

const Subtitle = styled.h2`
  font-size: 18px;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.85);
  margin: 0 0 8px 0;
`;

const Description = styled.p`
  font-size: 15px;
  color: rgba(255, 255, 255, 0.6);
  margin: 0 0 28px 0;
  line-height: 1.6;
`;

const Estimate = styled.div`
  background: rgba(108, 92, 231, 0.15);
  border: 1px solid rgba(108, 92, 231, 0.2);
  border-radius: 14px;
  padding: 14px 20px;
  display: inline-block;
  font-size: 14px;
  color: #a29bfe;
  margin-bottom: 28px;
  backdrop-filter: blur(10px);
`;

const ProgressSection = styled.div`
  margin-bottom: 32px;
`;

const ProgressBar = styled.div`
  width: 100%;
  height: 8px;
  background: rgba(255, 255, 255, 0.06);
  border-radius: 8px;
  overflow: hidden;
  margin-bottom: 10px;
  position: relative;
`;

const ProgressFill = styled.div`
  height: 100%;
  background: linear-gradient(90deg, #6c5ce7, #a29bfe, #6c5ce7);
  background-size: 200% 100%;
  border-radius: 8px;
  animation: ${progressShimmer} 2s linear infinite;
  width: ${props => props.percent}%;
  transition: width 0.5s ease;
  position: relative;

  &::after {
    content: '';
    position: absolute;
    top: 0;
    right: 0;
    bottom: 0;
    width: 20px;
    background: linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent);
    animation: ${shimmerLine} 1.5s ease-in-out infinite;
  }
`;

const ProgressLabel = styled.span`
  font-size: 12px;
  color: rgba(255, 255, 255, 0.35);
  letter-spacing: 1px;
  text-transform: uppercase;
`;

// ─── DECORATIVE ELEMENTS ──────────────────────────────────────

const OrbitalRing = styled.div`
  position: absolute;
  border-radius: 50%;
  border: 1px solid rgba(108, 92, 231, 0.05);
  pointer-events: none;
`;

const OrbitalRing1 = styled(OrbitalRing)`
  width: 400px;
  height: 400px;
  top: -100px;
  right: -150px;
  animation: ${rotate} 20s linear infinite;
  border-color: rgba(108, 92, 231, 0.03);
`;

const OrbitalRing2 = styled(OrbitalRing)`
  width: 300px;
  height: 300px;
  bottom: -80px;
  left: -120px;
  animation: ${rotate} 15s linear infinite reverse;
  border-color: rgba(162, 155, 254, 0.03);
`;

const GlowDot = styled.div`
  position: absolute;
  width: 200px;
  height: 200px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(108, 92, 231, 0.06) 0%, transparent 70%);
  pointer-events: none;
`;

const GlowDot1 = styled(GlowDot)`
  top: -80px;
  left: -80px;
`;

const GlowDot2 = styled(GlowDot)`
  bottom: -80px;
  right: -80px;
  background: radial-gradient(circle, rgba(162, 155, 254, 0.04) 0%, transparent 70%);
`;

// ─── MAIN COMPONENT ──────────────────────────────────────────

function MaintenanceOverride() {
  // If maintenance is disabled, render nothing
  if (!MAINTENANCE_ENABLED) {
    return null;
  }

  return (
    <Overlay>
      <Content>
        {/* Decorative background elements */}
        <GlowDot1 />
        <GlowDot2 />
        <OrbitalRing1 />
        <OrbitalRing2 />

        <IconWrapper>
          <AnimatedIcon>{MAINTENANCE_CONFIG.icon}</AnimatedIcon>
        </IconWrapper>

        <Title>{MAINTENANCE_CONFIG.title}</Title>
        <Subtitle>{MAINTENANCE_CONFIG.subtitle}</Subtitle>
        <Description>{MAINTENANCE_CONFIG.description}</Description>

        <Estimate>
          <span>{MAINTENANCE_CONFIG.estimatedTime}</span>
        </Estimate>

        <ProgressSection>
          <ProgressBar>
            <ProgressFill percent={MAINTENANCE_CONFIG.progressPercent} />
          </ProgressBar>
          <ProgressLabel>{MAINTENANCE_CONFIG.progressLabel}</ProgressLabel>
        </ProgressSection>

        {/* Small hint for admin */}
        <div style={{ 
          fontSize: '11px', 
          color: 'rgba(255,255,255,0.08)',
          letterSpacing: '0.5px',
          marginTop: '8px'
        }}>
          Maintenance Mode Active
        </div>
      </Content>
    </Overlay>
  );
}

export default MaintenanceOverride;
