import React, { useCallback, useEffect, useRef, useState } from 'react'
import ReactDOM from 'react-dom/client'
import axios from 'axios'
import { v4 as uuidv4 } from 'uuid'

import { SimliClient } from './SimliClient'

const sk = import.meta.env.VITE_SIMLI_API_KEY
const e11 = import.meta.env.VITE_ELEVENLABS_API_KEY

const completionEndpoint = import.meta.env?.VITE_COMPLETION_ENDPOINT || 'http://localhost:3000'

import './styles.css'

const AGENT_ID = 'b364d2e5-74d0-05b1-b689-7b1d9045a11e'
const SIMLI_FACE_ID = '370b1e0f-86b9-4040-aaba-dab636f11f53'
const ELEVENLABS_VOICE_ID = 'FaQ1mOmswLeENcFz2iJq'

const simliClient = new SimliClient()

const Navigation = () => {
  const [showDropdown, setShowDropdown] = useState(false);

  return (
    <nav className="fixed top-0 left-0 right-0 bg-black/50 backdrop-blur-md p-4 z-50">
      <div className="max-w-7xl mx-auto flex justify-between items-center text-white">
        <div className="text-xl font-bold">The Modern Jazz Institute</div>
        <div className="flex gap-4">
          <div className="relative">
            <button
              className="px-4 py-2 rounded hover:bg-white/10"
              onClick={() => setShowDropdown(!showDropdown)}
            >
              Learn More
            </button>
            {showDropdown && (
              <div className="absolute right-0 mt-2 w-48 rounded-md shadow-lg bg-black/80 backdrop-blur-md ring-1 ring-black ring-opacity-5">
                <div className="py-1" role="menu">
                  <button className="block w-full text-left px-4 py-2 text-sm hover:bg-white/10" role="menuitem">
                    Thesis
                  </button>
                  <button className="block w-full text-left px-4 py-2 text-sm hover:bg-white/10" role="menuitem">
                    Process
                  </button>
                  <button className="block w-full text-left px-4 py-2 text-sm hover:bg-white/10" role="menuitem">
                    Musicians and AI
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}

const Sidebar = () => (
  <div className="fixed right-0 top-0 h-full w-64 bg-black/50 backdrop-blur-md p-4 z-40 mt-16 text-white flex flex-col">
    <div className="flex-grow">
      <h2 className="text-lg font-bold mb-4">Get In The Shed</h2>
      <ul className="space-y-2">
        <li className="hover:bg-white/10 p-2 rounded cursor-pointer">
          <a href="https://shedding.notion.site/How-Jazz-Musicians-Can-Use-Technology-To-Become-Better-Players-And-Make-Global-Impacts-10daf7d31e8581e98d1bc81f7c3c0874?pvs=4"
             target="_blank"
             rel="noopener noreferrer"
             className="block w-full">
            Thesis
          </a>
        </li>
        <li className="hover:bg-white/10 p-2 rounded cursor-pointer">
          <a href="https://pitch.com/v/institute-of-modern-improvised-music-thesis-presentation-77uqhn"
             target="_blank"
             rel="noopener noreferrer"
             className="block w-full">
            Process
          </a>
        </li>
        <li className="hover:bg-white/10 p-2 rounded cursor-pointer">
          <a href="https://shedding.notion.site/Jazz-Musicians-with-Access-to-the-Modern-Economy-and-AI-Technology-Will-Change-the-World-13baf7d31e858175a835c2b53e0dc66a?pvs=4"
             target="_blank"
             rel="noopener noreferrer"
             className="block w-full">
            Musicians and AI
          </a>
        </li>
        <li className="hover:bg-white/10 p-2 rounded cursor-pointer">
          <a href="https://shedding.notion.site/Finding-Your-Own-Voice-Through-Improvisation-Dayna-Stephens-76ff9962aee240ff95c77382a529c376?pvs=4"
             target="_blank"
             rel="noopener noreferrer"
             className="block w-full">
            Improvisation & Composition
          </a>
        </li>
        <li className="hover:bg-white/10 p-2 rounded cursor-pointer">
          <a href="https://calendly.com/intheshed-live"
             target="_blank"
             rel="noopener noreferrer"
             className="block w-full">
            Jazz & Classical Theory
          </a>
        </li>
        <li className="hover:bg-white/10 p-2 rounded cursor-pointer">
          <a href="https://youtu.be/V1kavc50A3U?si=ezo6J_AL9a49DdjR"
             target="_blank"
             rel="noopener noreferrer"
             className="block w-full">
            Brazilian and African Music
          </a>
        </li>
        <li className="hover:bg-white/10 p-2 rounded cursor-pointer">
          <a href="https://youtube.com/@wholenotesorg"
             target="_blank"
             rel="noopener noreferrer"
             className="block w-full">
            Wellness for Musicians
          </a>
        </li>
        <li className="hover:bg-white/10 p-2 rounded cursor-pointer">
          <a href="https://example.com/guide?pvs=4"
             target="_blank"
             rel="noopener noreferrer"
             className="block w-full">
            Ear Training & Relative Pitch
          </a>
        </li>
        <li>
          <div className="hover:bg-white/10 p-2 rounded cursor-pointer">
            <a href="https://discord.com/invite/GAESQcyjfz"
               target="_blank"
               rel="noopener noreferrer"
               className="block w-full">
              Community Portal
            </a>
          </div>
          <div className="ml-4 mt-1">
            <a href="https://t.me/+NXeGUgtRKbA5MmY5"
               target="_blank"
               rel="noopener noreferrer"
               className="block hover:bg-white/10 p-2 rounded text-sm text-gray-300">
              Talk To Thelonious Punk AI
            </a>
          </div>
        </li>
        <li className="hover:bg-white/10 p-2 rounded cursor-pointer">
          <a href="https://calendly.com/intheshed-live"
             target="_blank"
             rel="noopener noreferrer"
             className="block w-full">
            Lessons
          </a>
        </li>
      </ul>
    </div>
    <div className="text-xs text-gray-400 mt-4 text-right">
      © {new Date().getFullYear()} The Benford Group LLC<br />
      All rights reserved
    </div>
  </div>
)

const App = () => {
  const [inputText, setInputText] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)
  const [error, setError] = useState('')
  const [_, setChatgptText] = useState('')
  const [startWebRTC, setStartWebRTC] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const cancelTokenRef = useRef<any | null>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const audioContextRef = useRef<any | null>(null)
  const analyserRef = useRef<any | null>(null)
  const microphoneRef = useRef<any | null>(null)

  // TODO: populate these from localStorage if roomid and useruuid are set, otherwise generate a random uuid
  const [roomID, setRoomID] = useState('')
  const [userUUID, setUserUUID] = useState('')

  useEffect(() => {
    const storedRoomID = localStorage.getItem('roomID')
    const storedUserUUID = localStorage.getItem('userUUID')
    if (storedRoomID && storedUserUUID) {
      setRoomID(storedRoomID)
      setUserUUID(storedUserUUID)
    } else {
      const newRoomID = uuidv4()
      const newUserUUID = uuidv4()
      setRoomID(newRoomID)
      setUserUUID(newUserUUID)
      localStorage.setItem('roomID', newRoomID)
      localStorage.setItem('userUUID', newUserUUID)
    }
  }, [])

  const initializeSimliClient = useCallback(() => {
    if (videoRef.current && audioRef.current) {
      const SimliConfig = {
        apiKey: sk,
        faceID: SIMLI_FACE_ID,
        handleSilence: true,
        videoRef: videoRef,
        audioRef: audioRef,
      }

      simliClient.Initialize(SimliConfig)
      console.log('Simli Client initialized')
    }
  }, [])

  useEffect(() => {
    initializeSimliClient()

    const handleConnected = () => {
      console.log('SimliClient is now connected!')
    }

    const handleDisconnected = () => {
      console.log('SimliClient has disconnected!')
    }

    const handleFailed = () => {
      console.log('SimliClient has failed to connect!')
      setError('Failed to connect to Simli. Please try again.')
    }

    const handleStarted = () => {
      console.log('SimliClient has started!')
      setIsLoading(false)
      setIsConnecting(false)
    }

    simliClient.on('connected', handleConnected)
    simliClient.on('disconnected', handleDisconnected)
    simliClient.on('failed', handleFailed)
    simliClient.on('started', handleStarted)

    return () => {
      simliClient.off('connected', handleConnected)
      simliClient.off('disconnected', handleDisconnected)
      simliClient.off('failed', handleFailed)
      simliClient.off('started', handleStarted)
      simliClient.close()
    }
  }, [initializeSimliClient])

  const handleStart = useCallback(() => {
    simliClient.start()
    setStartWebRTC(true)
    setIsLoading(true)
    setIsConnecting(true)

    setTimeout(() => {
      const audioData = new Uint8Array(6000).fill(0)
      simliClient.sendAudioData(audioData)
    }, 4000)
  }, [])

  const processInput = useCallback(async (text: any) => {
    setIsLoading(true)
    setError('')

    if (cancelTokenRef.current) {
      cancelTokenRef.current.cancel('Operation canceled by the user.')
    }

    cancelTokenRef.current = axios.CancelToken.source()

    try {
      console.log('sending input to chatgpt')
      const chatGPTResponse = await axios.post(
        completionEndpoint + `/${AGENT_ID}/message`,
        {
          text,
          roomId: roomID,
          userId: userUUID,
          userName: 'User',
        },
        {
          cancelToken: cancelTokenRef.current.token,
        }
      )

      console.log('chatGPTResponse', chatGPTResponse)

      const chatGPTText = chatGPTResponse.data[0].text
      if (!chatGPTText || chatGPTText.length === 0) {
        setError('No response from chatGPT. Please try again.')
        return
      }
      setChatgptText(chatGPTText)

      const elevenlabsResponse = await axios.post(
        `https://api.elevenlabs.io/v1/text-to-speech/${ELEVENLABS_VOICE_ID}?output_format=pcm_16000`,
        {
          text: chatGPTText,
          model_id: 'eleven_turbo_v2_5',
        },
        {
          headers: {
            'xi-api-key': e11,
            'Content-Type': 'application/json',
          },
          responseType: 'arraybuffer',
          cancelToken: cancelTokenRef.current.token,
        }
      )

      const pcm16Data = new Uint8Array(elevenlabsResponse.data)
      const chunkSize = 6000
      for (let i = 0; i < pcm16Data.length; i += chunkSize) {
        const chunk = pcm16Data.slice(i, i + chunkSize)
        simliClient.sendAudioData(chunk)
      }
    } catch (err) {
      if (axios.isCancel(err)) {
        console.log('Request canceled:', err.message)
      } else {
        setError('An error occurred. Please try again.')
        console.error(err)
      }
    } finally {
      setIsLoading(false)
      cancelTokenRef.current = null
    }
  }, [])

  const toggleListening = useCallback(() => {
    if (isListening) {
      console.log('Stopping mic')
      stopListening()
    } else {
      console.log('Starting mic')
      startListening()
    }
  }, [isListening])

  const sendAudioToWhisper = useCallback(
    async (audioBlob: Blob) => {
      const formData = new FormData()
      formData.append('file', audioBlob, 'audio.wav')

      try {
        const response = await axios.post(`${completionEndpoint}/${AGENT_ID}/whisper`, formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        })

        const transcribedText = response.data.text
        await processInput(transcribedText)
      } catch (error) {
        console.error('Error transcribing audio:', error)
        setError('Error transcribing audio. Please try again.')
      }
    },
    [processInput]
  )

  const startListening = useCallback(() => {
    setIsListening(true)
    navigator.mediaDevices
      .getUserMedia({ audio: true })
      .then((stream) => {
        if (!audioContextRef.current) {
          audioContextRef.current = new (window.AudioContext ||
            (window as any).webkitAudioContext)()
        }

        if (!analyserRef.current) {
          analyserRef.current = audioContextRef.current.createAnalyser()
          analyserRef.current.fftSize = 512
        }

        if (microphoneRef.current) {
          microphoneRef.current.disconnect()
        }

        microphoneRef.current = audioContextRef.current.createMediaStreamSource(stream)
        microphoneRef.current.connect(analyserRef.current)

        mediaRecorderRef.current = new MediaRecorder(stream)
        mediaRecorderRef.current.ondataavailable = (event) => {
          console.log('Data available:', event.data)
          chunksRef.current.push(event.data)
        }
        mediaRecorderRef.current.onstop = () => {
          console.log('Recorder stopped')
          const audioBlob = new Blob(chunksRef.current, { type: 'audio/wav' })
          sendAudioToWhisper(audioBlob)
          chunksRef.current = []
        }
        mediaRecorderRef.current.start()
      })
      .catch((err) => {
        console.error('Error accessing microphone:', err)
        setIsListening(false)
        setError('Error accessing microphone. Please check your permissions and try again.')
      })
  }, [sendAudioToWhisper])

  const stopListening = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop()
    }
    console.log('Stopping listening')
    setIsListening(false)
  }, [])

  useEffect(() => {
    console.log('isListening', isListening)
    console.log('chunksRef.current', chunksRef.current)

    if (!isListening && chunksRef.current.length > 0) {
      console.log('Sending audio to Whisper')
      const audioBlob = new Blob(chunksRef.current, { type: 'audio/wav' })
      sendAudioToWhisper(audioBlob)
      chunksRef.current = []
    }
  }, [isListening, sendAudioToWhisper])

  const handleSubmit = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault()
      const input = inputText.trim()
      setInputText('')
      await processInput(input)
    },
    [inputText, processInput]
  )

  return (
    <>
      <Navigation />
      <div className='flex h-screen w-full flex-col items-center justify-center font-mono text-white'>
        <div className='relative w-full max-w-2xl h-[80vh] mx-auto'>
          <video
            ref={videoRef}
            id='simli_video'
            autoPlay
            playsInline
            className='w-full h-full object-contain'
          ></video>
          <audio ref={audioRef} id='simli_audio' autoPlay></audio>
        </div>
        {startWebRTC && !isConnecting ? (
          <>
            <form
              onSubmit={handleSubmit}
              className='fixed bottom-4 mx-4 w-full max-w-2xl space-y-4 px-4'
            >
              <div className='flex w-full items-center space-x-2'>
                <input
                  type='text'
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder='Ask about music theory, compositions, or request a lesson...'
                  className='grow rounded border border-white/20 bg-black/50 backdrop-blur-md px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-white/50'
                />
                <button
                  type='submit'
                  disabled={isLoading || !inputText.trim()}
                  className='rounded bg-white/10 backdrop-blur-md px-4 py-3 text-2xl transition-colors hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-white/50 disabled:opacity-50'
                >
                  {isLoading ? '⏳' : '➡️'}
                </button>
                <button
                  type='button'
                  onClick={toggleListening}
                  className='rounded bg-blue-500/80 backdrop-blur-md px-4 py-3 text-2xl transition-colors hover:bg-blue-600/80 focus:outline-none focus:ring-2 focus:ring-blue-500/50'
                >
                  {isListening ? '🔴' : '🎤'}
                </button>
              </div>
            </form>
          </>
        ) : (
          <>
            {isConnecting && (
              <p className='fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-black/50 backdrop-blur-md p-4 rounded'>
                Connecting...
              </p>
            )}
            {!isConnecting && (
              <button
                disabled={isConnecting}
                onClick={handleStart}
                className='fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded bg-white/10 backdrop-blur-md px-6 py-3 text-lg transition-colors hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-white/50'
              >
                Start Music Lesson
              </button>
            )}
          </>
        )}
        {error && <p className='fixed bottom-20 mt-4 text-center text-red-500 bg-black/50 backdrop-blur-md p-2 rounded'>{error}</p>}
      </div>
      <Sidebar />
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          backgroundImage: 'url(./3.jpg)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          zIndex: -1000,
        }}
      />
    </>
  )
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
