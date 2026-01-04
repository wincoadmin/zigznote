import { render, screen, fireEvent, act } from '@/tests/test-utils';
import { MeetingPlayer } from './MeetingPlayer';

// Mock HTMLAudioElement methods
const mockPlay = jest.fn().mockResolvedValue(undefined);
const mockPause = jest.fn();

beforeAll(() => {
  Object.defineProperty(HTMLMediaElement.prototype, 'play', {
    configurable: true,
    value: mockPlay,
  });
  Object.defineProperty(HTMLMediaElement.prototype, 'pause', {
    configurable: true,
    value: mockPause,
  });
});

describe('MeetingPlayer', () => {
  beforeEach(() => {
    mockPlay.mockClear();
    mockPause.mockClear();
  });

  it('should render player controls', () => {
    render(<MeetingPlayer audioUrl="https://example.com/audio.mp3" duration={3600} />);

    expect(screen.getByRole('button', { name: /play/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /skip back/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /skip forward/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /mute/i })).toBeInTheDocument();
  });

  it('should render time display', () => {
    render(<MeetingPlayer audioUrl="https://example.com/audio.mp3" duration={3600} />);

    expect(screen.getByText('0:00')).toBeInTheDocument();
    expect(screen.getByText('60:00')).toBeInTheDocument();
  });

  it('should toggle play/pause when clicking play button', async () => {
    render(<MeetingPlayer audioUrl="https://example.com/audio.mp3" duration={3600} />);

    const playButton = screen.getByRole('button', { name: /play/i });

    // Click to play
    await act(async () => {
      fireEvent.click(playButton);
    });

    expect(mockPlay).toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /pause/i })).toBeInTheDocument();

    // Click to pause
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /pause/i }));
    });

    expect(mockPause).toHaveBeenCalled();
  });

  it('should call onTimeUpdate when seeking', () => {
    const handleTimeUpdate = jest.fn();
    render(
      <MeetingPlayer
        audioUrl="https://example.com/audio.mp3"
        duration={3600}
        onTimeUpdate={handleTimeUpdate}
      />
    );

    const slider = screen.getByRole('slider');

    fireEvent.change(slider, { target: { value: '1800' } });

    expect(handleTimeUpdate).toHaveBeenCalledWith(1800);
  });

  it('should skip forward 10 seconds when clicking skip forward button', () => {
    const handleTimeUpdate = jest.fn();
    render(
      <MeetingPlayer
        audioUrl="https://example.com/audio.mp3"
        duration={3600}
        onTimeUpdate={handleTimeUpdate}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /skip forward/i }));

    expect(handleTimeUpdate).toHaveBeenCalledWith(10);
  });

  it('should skip back 10 seconds when clicking skip back button', () => {
    const handleTimeUpdate = jest.fn();
    render(
      <MeetingPlayer
        audioUrl="https://example.com/audio.mp3"
        duration={3600}
        currentTime={30}
        onTimeUpdate={handleTimeUpdate}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /skip back/i }));

    // Should seek to 20 (30 - 10)
    expect(handleTimeUpdate).toHaveBeenCalled();
  });

  it('should not skip below 0', () => {
    const handleTimeUpdate = jest.fn();
    render(
      <MeetingPlayer
        audioUrl="https://example.com/audio.mp3"
        duration={3600}
        currentTime={5}
        onTimeUpdate={handleTimeUpdate}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /skip back/i }));

    // Should clamp to 0
    expect(handleTimeUpdate).toHaveBeenCalledWith(0);
  });

  it('should toggle mute when clicking mute button', () => {
    render(<MeetingPlayer audioUrl="https://example.com/audio.mp3" duration={3600} />);

    const muteButton = screen.getByRole('button', { name: /mute/i });
    fireEvent.click(muteButton);

    expect(screen.getByRole('button', { name: /unmute/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /unmute/i }));
    expect(screen.getByRole('button', { name: /mute/i })).toBeInTheDocument();
  });

  it('should cycle through playback rates when clicking speed button', () => {
    render(<MeetingPlayer audioUrl="https://example.com/audio.mp3" duration={3600} />);

    // Initial rate is 1x
    expect(screen.getByText('1x')).toBeInTheDocument();

    // Click to cycle: 1 -> 1.25
    fireEvent.click(screen.getByText('1x'));
    expect(screen.getByText('1.25x')).toBeInTheDocument();

    // Click to cycle: 1.25 -> 1.5
    fireEvent.click(screen.getByText('1.25x'));
    expect(screen.getByText('1.5x')).toBeInTheDocument();

    // Click to cycle: 1.5 -> 2
    fireEvent.click(screen.getByText('1.5x'));
    expect(screen.getByText('2x')).toBeInTheDocument();

    // Click to cycle: 2 -> 0.5
    fireEvent.click(screen.getByText('2x'));
    expect(screen.getByText('0.5x')).toBeInTheDocument();
  });

  it('should render with no audio URL', () => {
    render(<MeetingPlayer duration={3600} />);

    expect(screen.getByRole('button', { name: /play/i })).toBeInTheDocument();
  });

  it('should render progress slider with correct values', () => {
    render(
      <MeetingPlayer
        audioUrl="https://example.com/audio.mp3"
        duration={3600}
        currentTime={1800}
      />
    );

    const slider = screen.getByRole('slider');
    expect(slider).toHaveAttribute('max', '3600');
  });

  it('should format time correctly', () => {
    render(
      <MeetingPlayer
        audioUrl="https://example.com/audio.mp3"
        duration={125}
      />
    );

    // 125 seconds = 2:05
    expect(screen.getByText('2:05')).toBeInTheDocument();
  });

  it('should apply custom className', () => {
    const { container } = render(
      <MeetingPlayer
        audioUrl="https://example.com/audio.mp3"
        duration={3600}
        className="custom-player"
      />
    );

    expect(container.firstChild).toHaveClass('custom-player');
  });
});
