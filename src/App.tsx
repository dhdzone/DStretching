/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useRef, useEffect } from 'react';
import { Activity, Camera, UserCheck, FlipHorizontal, RotateCw, FolderOpen, PlusCircle, ListVideo, Play, Pause, SkipBack, SkipForward, Shuffle, Repeat, Maximize2, Minimize2, FastForward, Rewind, PlayCircle } from 'lucide-react';

export default function App() {
  const webcamRef = useRef<HTMLVideoElement>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const [cameraOverlay, setCameraOverlay] = useState(true);
  const [cameraError, setCameraError] = useState<string | null>(null);
  
  const [isFullscreen, setIsFullscreen] = useState(false);

  // 전체화면 토글
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => setIsFullscreen(true));
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false));
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  // 상태 관리
  const [playlist, setPlaylist] = useState<{ id: number; title: string; url: string }[]>([]);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [camIsMirrored, setCamIsMirrored] = useState(true);
  const [camRotation, setCamRotation] = useState(0);
  
  // 상태 추가
  const [shuffle, setShuffle] = useState(true);
  const [repeat, setRepeat] = useState(1); // 0: 끄기, 1: 전체, 2: 1곡
  const [isPlaylistModalOpen, setIsPlaylistModalOpen] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [unplayedIndices, setUnplayedIndices] = useState<number[]>([]);

  // 재생 목록 관련
  const removeTrack = (index: number) => {
    URL.revokeObjectURL(playlist[index].url);
    const newPlaylist = playlist.filter((_, i) => i !== index);
    setPlaylist(newPlaylist);
    setUnplayedIndices(current => current.filter(i => i !== index).map(i => i > index ? i - 1 : i));
    if(currentIndex === index) {
      if(newPlaylist.length > 0) setCurrentIndex(0);
      else setCurrentIndex(-1);
    } else if(currentIndex > index) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  const clearPlaylist = () => {
    playlist.forEach(item => URL.revokeObjectURL(item.url));
    setPlaylist([]);
    setUnplayedIndices([]);
    setCurrentIndex(-1);
    setIsPlaying(false);
  };

  // 비디오 제어 함수들 (빨리감기, 느리게, 5초 앞/뒤)
  const changeSpeed = (speed: number) => {
    if (localVideoRef.current) localVideoRef.current.playbackRate = speed;
  }
  const skipTime = (seconds: number) => {
    if (localVideoRef.current) {
        localVideoRef.current.currentTime = Math.max(0, Math.min(localVideoRef.current.duration, localVideoRef.current.currentTime + seconds));
    }
  }
  
  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  };

  // 비디오 이벤트
  useEffect(() => {
    const video = localVideoRef.current;
    if (!video) return;

    const handleEnded = () => {
      if (repeat === 2) {
        video.currentTime = 0;
        video.play().catch(e => console.error("Play interrupted:", e));
      } else if (repeat === 0 && !shuffle && currentIndex === playlist.length - 1) {
        setIsPlaying(false);
      } else {
        playNext();
      }
    };
    const handleTimeUpdate = () => {
      setCurrentTime(video.currentTime);
      setDuration(video.duration);
    };
    const handleLoadedMetadata = () => {
      setDuration(video.duration);
    };
    
    video.addEventListener('ended', handleEnded);
    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    
    return () => {
      video.removeEventListener('ended', handleEnded);
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
    };
  }, [currentIndex, repeat, playlist, shuffle]);

  const playNext = () => {
    if (playlist.length === 0) return;
    
    let nextIndex = currentIndex;

    if (shuffle && playlist.length > 1) {
      if (unplayedIndices.length === 0) {
          // Reset unplayed list, excluding current index if possible
          const newIndices = Array.from({length: playlist.length}, (_, i) => i).filter(i => i !== currentIndex);
          const randomIndex = Math.floor(Math.random() * newIndices.length);
          nextIndex = newIndices[randomIndex];
          
          let remaining = newIndices.filter(i => i !== nextIndex);
          if (remaining.length === 0 && playlist.length > 1) {
             remaining = [currentIndex];
          }
          setUnplayedIndices(remaining);
      } else {
          // Pull from unplayed list
          const randomIndex = Math.floor(Math.random() * unplayedIndices.length);
          nextIndex = unplayedIndices[randomIndex];
          setUnplayedIndices(prev => prev.filter(i => i !== nextIndex));
      }
    } else {
      nextIndex = (currentIndex + 1) % playlist.length;
    }
    
    if (nextIndex === currentIndex && localVideoRef.current && playlist.length === 1) {
      localVideoRef.current.currentTime = 0;
      localVideoRef.current.play().catch(e => console.error("Play interrupted:", e));
      setIsPlaying(true);
    } else {
      setCurrentIndex(nextIndex);
    }
  };

  const playPrev = () => {
    if (playlist.length === 0) return;
    setCurrentIndex((prev) => {
      const nextIndex = (prev - 1 + playlist.length) % playlist.length;
      
      if (nextIndex === prev && localVideoRef.current) {
        localVideoRef.current.currentTime = 0;
        localVideoRef.current.play().catch(e => console.error("Play interrupted:", e));
        setIsPlaying(true);
      }
      return nextIndex;
    });
  };

  useEffect(() => {
    if (currentIndex !== -1 && localVideoRef.current) {
      localVideoRef.current.src = playlist[currentIndex].url;
      // 재생 중인 경우에만 load 후 play
      localVideoRef.current.play().catch(e => {
        if (e.name !== 'AbortError') console.error("Play interrupted:", e);
      });
      setIsPlaying(true);
    }
  }, [currentIndex]);

  const togglePlay = () => {
    const video = localVideoRef.current;
    if (!video) return;
    
    // 현재 재생 상태에 따라 명확하게 처리
    if (video.paused) {
      // pause 상태일 때만 play
      video.play().then(() => setIsPlaying(true)).catch(e => {
        if (e.name !== 'AbortError') console.error("Play interrupted:", e);
      });
    } else {
      // play 상태일 때만 pause
      video.pause();
      setIsPlaying(false);
    }
  };


  // 카메라 시작
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          facingMode: "user",
          width: { ideal: 2592 },
          height: { ideal: 1944 }
        }, 
        audio: false 
      });
      if (webcamRef.current) webcamRef.current.srcObject = stream;
      setCameraOverlay(false);
    } catch (error: any) {
      if (error.name === 'NotAllowedError') setCameraError("브라우저 설정에서 카메라 권한을 허용해 주세요.");
      else if (error.name === 'NotFoundError') setCameraError("연결된 카메라 기기를 찾을 수 없습니다.");
      else setCameraError("카메라를 켤 수 없습니다: " + error.message);
    }
  };

  return (
    <div className="h-screen w-full flex flex-col overflow-hidden text-slate-800 font-sans transition-colors duration-500 bg-slate-50">
      <header className="bg-white/80 backdrop-blur-md border-b border-slate-200 shadow-sm py-2 px-4 flex justify-between items-center z-10">
        <div className="flex items-center gap-2">
            <div className="bg-blue-600 text-white p-1.5 rounded-lg shadow-sm">
                <Activity className="w-5 h-5" />
            </div>
            <h1 className="text-lg font-bold tracking-tight text-slate-900">대화노인종합복지관 디지털 체험존 「스마트 건강 체조」</h1>
        </div>
        <button onClick={toggleFullscreen} className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors flex items-center gap-2 text-sm font-semibold shadow-sm">
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            <span className="hidden md:inline">전체화면</span>
        </button>
      </header>

      <main className="flex-1 w-full max-w-[1920px] mx-auto p-2 md:p-4 flex flex-col lg:flex-row gap-4 h-[calc(100vh-50px)] box-border">
        
        <section className="lg:w-[35%] h-full bg-white rounded-[1.5rem] shadow-xl shadow-slate-200/50 flex flex-col overflow-hidden border border-slate-100 relative">
            <div className="flex-1 relative bg-slate-900 flex flex-col justify-center items-center overflow-hidden">
                <video ref={webcamRef} className="absolute w-full h-full object-cover" style={{transform: `scaleX(${camIsMirrored ? -1 : 1}) rotate(${camRotation}deg)`}} autoPlay playsInline></video>
                {cameraOverlay && (
                    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-slate-900/60 backdrop-blur-sm p-6 text-center">
                        <div className="bg-white/10 p-4 rounded-full mb-4">
                            <UserCheck className="w-12 h-12 text-white" />
                        </div>
                        <p className="text-white text-lg mb-8 font-medium drop-shadow-md">바른 자세를 유지하기 위해<br/>카메라를 켜주세요.</p>
                        <button onClick={startCamera} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 px-8 rounded-2xl text-xl shadow-lg transition-all active:scale-95 flex items-center gap-3">카메라 켜기</button>
                        {cameraError && <p className="text-red-300 text-sm mt-4 bg-slate-900/80 px-4 py-2 rounded-lg">{cameraError}</p>}
                    </div>
                )}
            </div>
            <div className="p-3 px-4 flex justify-between items-center border-t border-slate-100 bg-slate-50">
                <h2 className="text-lg font-bold flex items-center gap-2 text-slate-800"><Camera className="w-5 h-5 text-blue-500" />선배님의 모습을 확인 해보세요!</h2>
                <div className="flex gap-2">
                    <button onClick={() => setCamIsMirrored(!camIsMirrored)} className={`text-xs font-semibold px-3 py-1.5 rounded-full transition-all flex items-center gap-1 shadow-sm ${camIsMirrored ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-700 hover:bg-slate-300'}`}><FlipHorizontal className="w-3 h-3" />거울모드</button>
                    <button onClick={() => setCamRotation((r) => (r + 90) % 360)} className="text-xs font-semibold bg-slate-200 text-slate-700 hover:bg-slate-300 px-3 py-1.5 rounded-full transition-all flex items-center gap-1 shadow-sm"><RotateCw className="w-3 h-3" />회전</button>
                </div>
            </div>
        </section>

        <section className="lg:w-[65%] h-full flex flex-col gap-4">
            <div className="w-full bg-black rounded-[1.5rem] shadow-xl overflow-hidden relative" style={{paddingTop: '56.25%'}}>
                <div className="absolute inset-0 w-full h-full flex items-center justify-center">
                    {currentIndex === -1 && (
                        <div className="text-center text-slate-400 flex flex-col items-center z-10 p-4">
                            <ListVideo className="w-16 h-16 mb-4 opacity-50" />
                            <p className="text-lg font-bold">영상 파일을 불러와 주세요.</p>
                            <div className="mt-4 flex flex-wrap justify-center gap-2 max-w-sm">
                                {playlist.map((item, index) => (
                                    <button key={item.id} onClick={() => setCurrentIndex(index)} className={`px-3 py-1 rounded-full text-sm font-medium ${index === currentIndex ? 'bg-blue-600 text-white' : 'bg-white/10 text-white hover:bg-white/20'}`}>
                                        {item.title.replace(/\.[^/.]+$/, "")}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                    <video ref={localVideoRef} className={`w-full h-full object-contain ${currentIndex === -1 ? 'hidden' : ''}`} controls></video>
                </div>
            </div>

            <div className="bg-white rounded-[1.5rem] shadow-xl shadow-slate-200/50 border border-slate-100 p-4 flex flex-col">
              <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-3">
                  <h3 className="text-sm font-bold text-slate-500 flex items-center gap-2 underline underline-offset-4 cursor-pointer" onClick={() => setIsPlaylistModalOpen(true)}>
                      <ListVideo className="w-4 h-4" />영상 관리 ({playlist.length}개)
                  </h3>
                  <div className="flex gap-2">
                    {/* 파일 선택 */}
                    <input type="file" id="file-input" accept="video/*" multiple className="hidden" onChange={(e) => {
                      const files = Array.from((e.target as HTMLInputElement).files || []);
                      const newItems = files.map(f => ({ id: Date.now() + Math.random(), title: f.name, url: URL.createObjectURL(f) }));
                      const newPlaylist = [...playlist, ...newItems];
                      setPlaylist(newPlaylist);
                      setUnplayedIndices(prev => [...prev, ...Array.from({length: newItems.length}, (_, i) => playlist.length + i)]);
                      if (currentIndex === -1) setCurrentIndex(0);
                    }} />
                    {/* 폴더 선택 */}
                    <input type="file" id="folder-input" webkitdirectory="" directory="" multiple className="hidden" onChange={(e) => {
                      const files = Array.from((e.target as HTMLInputElement).files || []);
                      const newItems = files.filter(f => f.type.startsWith('video/')).map(f => ({ id: Date.now() + Math.random(), title: f.name, url: URL.createObjectURL(f) }));
                      const newPlaylist = [...playlist, ...newItems];
                      setPlaylist(newPlaylist);
                      setUnplayedIndices(prev => [...prev, ...Array.from({length: newItems.length}, (_, i) => playlist.length + i)]);
                      if (currentIndex === -1) setCurrentIndex(0);
                    }} />
                    
                    <button onClick={() => document.getElementById('file-input')?.click()} className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1 shadow-md transition-all active:scale-95">
                        <PlusCircle className="w-4 h-4" /> 파일
                    </button>
                    <button onClick={() => document.getElementById('folder-input')?.click()} className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1 shadow-md transition-all active:scale-95">
                        <FolderOpen className="w-4 h-4" /> 폴더
                    </button>
                    <button onClick={() => setIsPlaylistModalOpen(true)} className="bg-slate-200 hover:bg-slate-300 text-slate-700 px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1 shadow-md transition-all active:scale-95">
                        <ListVideo className="w-4 h-4" /> 관리
                    </button>
                  </div>
              </div>

              {/* 플레이리스트 모달 */}
              {isPlaylistModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
                  <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl flex flex-col max-h-[80vh]">
                    <div className="p-4 border-b border-slate-100 flex justify-between items-center">
                        <h3 className="font-bold text-lg text-slate-800">재생 목록</h3>
                        <button onClick={() => setIsPlaylistModalOpen(false)} className="text-slate-500 hover:text-black">닫기</button>
                    </div>
                    <div className="flex-1 overflow-y-auto p-3">
                      {playlist.length === 0 ? <p className="text-center text-slate-400 py-10">목록이 비어있습니다.</p> : playlist.map((item, index) => (
                        <div key={item.id} className={`flex items-center justify-between p-2 rounded-md ${index === currentIndex ? 'bg-blue-50' : 'hover:bg-slate-50'}`}>
                          <span className="truncate text-sm" onClick={() => { setCurrentIndex(index); setIsPlaylistModalOpen(false); }}>{item.title}</span>
                          <button onClick={() => removeTrack(index)} className="text-red-500 hover:text-red-700 ml-2">삭제</button>
                        </div>
                      ))}
                    </div>
                    <div className="p-4 border-t border-slate-100">
                        <button onClick={clearPlaylist} className="w-full bg-red-100 text-red-600 font-bold py-2 rounded-xl hover:bg-red-200">목록 전체 비우기</button>
                    </div>
                  </div>
                </div>
              )}

              {/* 플레이어 컨트롤 및 영상 목록 */}
              <div className="flex flex-col gap-4">
                
                {/* 0. 프로그레스 바 */}
                <div className="flex items-center gap-3 px-1">
                    <span className="text-xs font-mono text-slate-500 w-10 text-right">{formatTime(currentTime)}</span>
                    <input type="range" min="0" max={duration || 0} value={currentTime}
                      onChange={(e) => {
                        const time = parseFloat(e.target.value);
                        if (localVideoRef.current) localVideoRef.current.currentTime = time;
                        setCurrentTime(time);
                      }}
                      className="flex-1 h-1.5 rounded-lg appearance-none cursor-pointer bg-slate-200 accent-blue-600"
                    />
                    <span className="text-xs font-mono text-slate-500 w-10">{formatTime(duration)}</span>
                </div>

                {/* 1. 통합 재생 컨트롤 박스 (한 줄) */}
                <div className="bg-slate-50 p-3 rounded-2xl flex items-center justify-center gap-3">
                    {/* 세밀한 제어 (한글) */}
                    <div className="flex items-center gap-1.5 flex-wrap justify-center border-r border-slate-200 pr-3">
                        <button onClick={() => changeSpeed(0.5)} className="text-xs bg-white border border-slate-200 px-2.5 py-1 rounded-lg hover:bg-slate-100">0.5배</button>
                        <button onClick={() => changeSpeed(1)} className="text-xs bg-white border border-slate-200 px-2.5 py-1 rounded-lg hover:bg-slate-100">정속</button>
                        <button onClick={() => changeSpeed(1.5)} className="text-xs bg-white border border-slate-200 px-2.5 py-1 rounded-lg hover:bg-slate-100">1.5배</button>
                        <button onClick={() => skipTime(-5)} className="text-xs bg-white border border-slate-200 px-2.5 py-1 rounded-lg hover:bg-slate-100">5초뒤</button>
                        <button onClick={() => skipTime(5)} className="text-xs bg-white border border-slate-200 px-2.5 py-1 rounded-lg hover:bg-slate-100">5초앞</button>
                    </div>

                    {/* 기본 재생 컨트롤 */}
                    <div className="flex items-center gap-2 pl-1">
                        <button onClick={() => setRepeat((r) => (r + 1) % 3)} className={`p-2 rounded-full transition-colors ${repeat !== 0 ? 'text-blue-600 bg-blue-100' : 'text-slate-400 hover:bg-slate-200'}`}>
                        <Repeat className="w-5 h-5" />
                        </button>
                        <button onClick={playPrev} className="p-2 rounded-full text-slate-600 hover:bg-slate-200"><SkipBack className="w-6 h-6" /></button>
                        <button onClick={togglePlay} className="p-3 rounded-full bg-blue-600 text-white shadow-md hover:bg-blue-700 active:scale-95 transition-all">
                        {isPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6" />}
                        </button>
                        <button onClick={playNext} className="p-2 rounded-full text-slate-600 hover:bg-slate-200"><SkipForward className="w-6 h-6" /></button>
                        <button onClick={() => setShuffle(!shuffle)} className={`p-2 rounded-full transition-colors ${shuffle ? 'text-blue-600 bg-blue-100' : 'text-slate-400 hover:bg-slate-200'}`}>
                        <Shuffle className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* 2. 영상 목록 버튼들 (재생 컨트롤 아래) */}
                {playlist.length > 0 && (
                    <div className="flex flex-wrap justify-center gap-2">
                        {playlist.map((item, index) => (
                            <button key={item.id} onClick={() => setCurrentIndex(index)} className={`px-4 py-2 rounded-xl text-sm font-bold shadow-sm transition-all ${index === currentIndex ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}>
                                {item.title.replace(/\.[^/.]+$/, "")}
                            </button>
                        ))}
                    </div>
                )}
              </div>
            </div>
        </section>
      </main>
    </div>
  );
}
