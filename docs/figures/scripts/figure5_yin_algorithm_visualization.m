% Figure 5: YIN Algorithm Visualization
% Four-panel visualization showing YIN pitch detection processing stages
% Mambo Whistle Technical Report
%
% Author: Mambo Whistle Team
% Date: 2025

clear; clc; close all;

%% ========================================================================
%  GOOGLE COLOR PALETTE
%  ========================================================================

google_blue   = [66, 133, 244] / 255;   % #4285F4
google_red    = [234, 67, 53] / 255;    % #EA4335
google_yellow = [251, 188, 5] / 255;    % #FBBC05
google_green  = [52, 168, 83] / 255;    % #34A853
google_gray   = [95, 99, 104] / 255;    % #5F6368

%% ========================================================================
%  GENERATE SYNTHETIC VOCAL SIGNAL (F0 = 220 Hz, A3)
%  ========================================================================

fs = 44100;                 % Sample rate
N = 1024;                   % Window size (same as our system)
f0_true = 220;              % True fundamental frequency (A3)
t = (0:N-1) / fs;           % Time vector

% Generate harmonic-rich signal simulating human voice
% Fundamental + harmonics with decreasing amplitude + slight noise
signal = zeros(1, N);
num_harmonics = 8;
for h = 1:num_harmonics
    amplitude = 1 / h^0.8;  % Harmonic roll-off
    phase = rand() * 2 * pi;  % Random phase
    signal = signal + amplitude * sin(2 * pi * f0_true * h * t + phase);
end

% Add slight noise (simulating breath/microphone noise)
signal = signal + 0.02 * randn(1, N);

% Normalize
signal = signal / max(abs(signal)) * 0.9;

%% ========================================================================
%  YIN ALGORITHM IMPLEMENTATION
%  ========================================================================

W = N / 2;  % Integration window (half of buffer)

% Step 1: Squared Difference Function
d = zeros(1, W);
for tau = 1:W
    for j = 1:(N-tau)
        d(tau) = d(tau) + (signal(j) - signal(j + tau))^2;
    end
end

% Step 2: Cumulative Mean Normalized Difference Function
d_prime = zeros(1, W);
d_prime(1) = 1;
cumsum_d = 0;
for tau = 2:W
    cumsum_d = cumsum_d + d(tau);
    if cumsum_d > 0
        d_prime(tau) = d(tau) / (cumsum_d / tau);
    else
        d_prime(tau) = 1;
    end
end

% Step 3: Absolute Threshold
threshold = 0.15;
tau_estimate = 0;
for tau = 2:W
    if d_prime(tau) < threshold
        % Find local minimum
        while tau + 1 < W && d_prime(tau + 1) < d_prime(tau)
            tau = tau + 1;
        end
        tau_estimate = tau;
        break;
    end
end

% Fallback if no threshold crossing
if tau_estimate == 0
    [~, tau_estimate] = min(d_prime(2:end));
    tau_estimate = tau_estimate + 1;
end

% Step 4: Parabolic Interpolation
if tau_estimate > 1 && tau_estimate < W
    y_prev = d_prime(tau_estimate - 1);
    y_curr = d_prime(tau_estimate);
    y_next = d_prime(tau_estimate + 1);

    delta = 0.5 * (y_prev - y_next) / (y_prev - 2*y_curr + y_next);
    tau_refined = tau_estimate + delta;
else
    tau_refined = tau_estimate;
    delta = 0;
end

% Calculate detected frequency
f0_detected = fs / tau_refined;
confidence = 1 - d_prime(tau_estimate);

%% ========================================================================
%  FIGURE SETUP - 4 PANEL LAYOUT
%  ========================================================================

figureUnits = 'centimeters';
figureWidth = 16;
figureHeight = 20;

figureHandle = figure('Name', 'YIN Algorithm Visualization');
set(gcf, 'Units', figureUnits, 'Position', [2 2 figureWidth figureHeight]);
set(gcf, 'Color', [1 1 1]);

% Panel spacing
panel_height = 0.19;
panel_gap = 0.05;
panel_bottom = [0.74, 0.51, 0.28, 0.06];
panel_left = 0.12;
panel_width = 0.82;

%% ========================================================================
%  PANEL (a): INPUT WAVEFORM
%  ========================================================================

ax1 = axes('Position', [panel_left, panel_bottom(1), panel_width, panel_height]);
hold on;

% Time in milliseconds
t_ms = t * 1000;

% Plot waveform
plot(t_ms, signal, 'Color', google_blue, 'LineWidth', 1.2);

% Mark two periods
period_ms = 1000 / f0_true;
for p = 1:2
    xline(p * period_ms, '--', 'Color', google_red, 'LineWidth', 1, 'Alpha', 0.7);
end

% Annotations
text(period_ms/2, 0.75, 'T_0', 'FontName', 'Times New Roman', 'FontSize', 10, ...
    'HorizontalAlignment', 'center', 'Color', google_red);

% Arrow for period
annotation('doublearrow', [0.18, 0.32], [0.88, 0.88], ...
    'Color', google_red, 'LineWidth', 1);

% Styling
set(ax1, 'XLim', [0, t_ms(end)], 'YLim', [-1.1, 1.1]);
set(ax1, 'XTick', 0:5:25);
set(ax1, 'YTick', -1:0.5:1);
xlabel('Time (ms)', 'FontName', 'Times New Roman', 'FontSize', 11);
ylabel('Amplitude', 'FontName', 'Times New Roman', 'FontSize', 11);
title('(a) Input Waveform', 'FontName', 'Times New Roman', 'FontSize', 12, 'FontWeight', 'bold');

set(ax1, 'Box', 'off', 'LineWidth', 1, 'TickDir', 'out', ...
    'FontName', 'Times New Roman', 'FontSize', 10, ...
    'XColor', [0.15 0.15 0.15], 'YColor', [0.15 0.15 0.15], ...
    'XGrid', 'on', 'YGrid', 'on', 'GridAlpha', 0.2, 'GridLineStyle', ':');

%% ========================================================================
%  PANEL (b): SQUARED DIFFERENCE FUNCTION
%  ========================================================================

ax2 = axes('Position', [panel_left, panel_bottom(2), panel_width, panel_height]);
hold on;

% Lag in samples converted to time
lag_samples = 1:W;
lag_ms = lag_samples / fs * 1000;

% Plot squared difference
plot(lag_ms, d, 'Color', google_yellow, 'LineWidth', 1.5);

% Mark minimum (fundamental period)
[min_d, min_idx] = min(d(20:end));  % Skip very low lags
min_idx = min_idx + 19;
min_lag_ms = min_idx / fs * 1000;

scatter(min_lag_ms, min_d, 80, 'o', ...
    'MarkerFaceColor', google_green, ...
    'MarkerEdgeColor', [0.2 0.2 0.2], ...
    'LineWidth', 1.5);

% Annotation
text(min_lag_ms + 0.5, min_d + max(d)*0.08, sprintf('\\tau = %.1f ms', min_lag_ms), ...
    'FontName', 'Times New Roman', 'FontSize', 9, 'Color', google_green*0.8);

% Styling
set(ax2, 'XLim', [0, lag_ms(end)], 'YLim', [0, max(d)*1.1]);
xlabel('Lag \tau (ms)', 'FontName', 'Times New Roman', 'FontSize', 11);
ylabel('d(\tau)', 'FontName', 'Times New Roman', 'FontSize', 11);
title('(b) Squared Difference Function', 'FontName', 'Times New Roman', 'FontSize', 12, 'FontWeight', 'bold');

set(ax2, 'Box', 'off', 'LineWidth', 1, 'TickDir', 'out', ...
    'FontName', 'Times New Roman', 'FontSize', 10, ...
    'XColor', [0.15 0.15 0.15], 'YColor', [0.15 0.15 0.15], ...
    'XGrid', 'on', 'YGrid', 'on', 'GridAlpha', 0.2, 'GridLineStyle', ':');

%% ========================================================================
%  PANEL (c): CUMULATIVE MEAN NORMALIZED DIFFERENCE
%  ========================================================================

ax3 = axes('Position', [panel_left, panel_bottom(3), panel_width, panel_height]);
hold on;

% Plot CMND function
plot(lag_ms, d_prime, 'Color', google_red, 'LineWidth', 1.5);

% Threshold line
yline(threshold, '--', 'Color', google_gray, 'LineWidth', 1.5);
text(lag_ms(end)*0.85, threshold + 0.05, sprintf('\\theta = %.2f', threshold), ...
    'FontName', 'Times New Roman', 'FontSize', 9, 'Color', google_gray);

% Mark detected period
detected_lag_ms = tau_estimate / fs * 1000;
scatter(detected_lag_ms, d_prime(tau_estimate), 100, 'p', ...
    'MarkerFaceColor', google_green, ...
    'MarkerEdgeColor', [0.2 0.2 0.2], ...
    'LineWidth', 1.5);

% Vertical line at detection point
xline(detected_lag_ms, ':', 'Color', google_green, 'LineWidth', 1.2);

% Annotation
text(detected_lag_ms + 0.3, d_prime(tau_estimate) - 0.08, ...
    sprintf('Detected: %.2f ms', detected_lag_ms), ...
    'FontName', 'Times New Roman', 'FontSize', 9, 'Color', google_green*0.8);

% Styling
set(ax3, 'XLim', [0, lag_ms(end)], 'YLim', [0, 1.5]);
set(ax3, 'YTick', 0:0.25:1.5);
xlabel('Lag \tau (ms)', 'FontName', 'Times New Roman', 'FontSize', 11);
ylabel('d''(\tau)', 'FontName', 'Times New Roman', 'FontSize', 11);
title('(c) Cumulative Mean Normalized Difference', 'FontName', 'Times New Roman', 'FontSize', 12, 'FontWeight', 'bold');

set(ax3, 'Box', 'off', 'LineWidth', 1, 'TickDir', 'out', ...
    'FontName', 'Times New Roman', 'FontSize', 10, ...
    'XColor', [0.15 0.15 0.15], 'YColor', [0.15 0.15 0.15], ...
    'XGrid', 'on', 'YGrid', 'on', 'GridAlpha', 0.2, 'GridLineStyle', ':');

%% ========================================================================
%  PANEL (d): PARABOLIC INTERPOLATION DETAIL
%  ========================================================================

ax4 = axes('Position', [panel_left, panel_bottom(4), panel_width, panel_height]);
hold on;

% Zoom into region around detected minimum
zoom_range = max(1, tau_estimate-15):min(W, tau_estimate+15);
zoom_lag_ms = zoom_range / fs * 1000;

% Plot CMND in zoom region
plot(zoom_lag_ms, d_prime(zoom_range), 'Color', google_red, 'LineWidth', 1.5);

% Plot the three points used for interpolation
if tau_estimate > 1 && tau_estimate < W
    interp_points = [tau_estimate-1, tau_estimate, tau_estimate+1];
    interp_lag_ms = interp_points / fs * 1000;
    interp_vals = d_prime(interp_points);

    scatter(interp_lag_ms, interp_vals, 80, 'o', ...
        'MarkerFaceColor', google_blue, ...
        'MarkerEdgeColor', [0.2 0.2 0.2], ...
        'LineWidth', 1.2);

    % Fit and plot parabola
    p_coeffs = polyfit(interp_lag_ms - interp_lag_ms(2), interp_vals, 2);
    para_x = linspace(interp_lag_ms(1), interp_lag_ms(3), 100) - interp_lag_ms(2);
    para_y = polyval(p_coeffs, para_x);
    plot(para_x + interp_lag_ms(2), para_y, '--', 'Color', google_yellow, 'LineWidth', 1.5);

    % Refined minimum point
    refined_lag_ms = tau_refined / fs * 1000;
    refined_val = polyval(p_coeffs, refined_lag_ms - interp_lag_ms(2));

    scatter(refined_lag_ms, refined_val, 120, 'p', ...
        'MarkerFaceColor', google_green, ...
        'MarkerEdgeColor', [0.2 0.2 0.2], ...
        'LineWidth', 2);

    % Vertical line to show refinement
    plot([interp_lag_ms(2), refined_lag_ms], [interp_vals(2), interp_vals(2)], ...
        ':', 'Color', google_green, 'LineWidth', 1);
end

% Annotations with results
result_str = sprintf('f_0 = %.1f Hz\nConfidence = %.2f', f0_detected, confidence);
text(zoom_lag_ms(end)*0.7, max(d_prime(zoom_range))*0.85, result_str, ...
    'FontName', 'Times New Roman', 'FontSize', 10, ...
    'BackgroundColor', [1 1 1 0.8], 'EdgeColor', google_gray, ...
    'HorizontalAlignment', 'center');

% Styling
set(ax4, 'XLim', [zoom_lag_ms(1), zoom_lag_ms(end)]);
xlabel('Lag \tau (ms)', 'FontName', 'Times New Roman', 'FontSize', 11);
ylabel('d''(\tau)', 'FontName', 'Times New Roman', 'FontSize', 11);
title('(d) Parabolic Interpolation Detail', 'FontName', 'Times New Roman', 'FontSize', 12, 'FontWeight', 'bold');

set(ax4, 'Box', 'off', 'LineWidth', 1, 'TickDir', 'out', ...
    'FontName', 'Times New Roman', 'FontSize', 10, ...
    'XColor', [0.15 0.15 0.15], 'YColor', [0.15 0.15 0.15], ...
    'XGrid', 'on', 'YGrid', 'on', 'GridAlpha', 0.2, 'GridLineStyle', ':');

% Legend for panel (d)
h_discrete = scatter(nan, nan, 60, 'o', 'MarkerFaceColor', google_blue, 'MarkerEdgeColor', [0.2 0.2 0.2]);
h_parabola = plot(nan, nan, '--', 'Color', google_yellow, 'LineWidth', 1.5);
h_refined = scatter(nan, nan, 100, 'p', 'MarkerFaceColor', google_green, 'MarkerEdgeColor', [0.2 0.2 0.2]);

legend([h_discrete, h_parabola, h_refined], ...
    {'Discrete samples', 'Parabolic fit', 'Refined estimate'}, ...
    'Location', 'northeast', 'Box', 'off', ...
    'FontName', 'Times New Roman', 'FontSize', 9);

%% ========================================================================
%  EXPORT FIGURE
%  ========================================================================

% Set paper properties
set(figureHandle, 'PaperUnits', figureUnits);
set(figureHandle, 'PaperPosition', [0 0 figureWidth figureHeight]);
set(figureHandle, 'PaperSize', [figureWidth figureHeight]);

% Output paths
scriptPath = fileparts(mfilename('fullpath'));
outputPath = fullfile(scriptPath, '..', 'output');

% Export as PNG (300 DPI)
print(figureHandle, fullfile(outputPath, 'figure5_yin_algorithm_visualization.png'), ...
    '-dpng', '-r300');

% Export as PDF (vector)
print(figureHandle, fullfile(outputPath, 'figure5_yin_algorithm_visualization.pdf'), ...
    '-dpdf', '-bestfit');

% Export as EPS (vector)
print(figureHandle, fullfile(outputPath, 'figure5_yin_algorithm_visualization.eps'), ...
    '-depsc2');

fprintf('Figure 5 exported successfully!\n');
fprintf('Detected F0: %.2f Hz (True: %.0f Hz)\n', f0_detected, f0_true);
fprintf('Confidence: %.3f\n', confidence);
fprintf('Output location: %s\n', outputPath);
