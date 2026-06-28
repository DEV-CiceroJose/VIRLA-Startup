import { useState, useRef, useCallback } from 'react'

export function useAudioRecorder() {
  const [isRecording, setIsRecording] = useState(false)
  const [audioBlob, setAudioBlob] = useState(null)
  const mediaRecorderRef = useRef(null)
  const chunksRef = useRef([])

  const startRecording = useCallback(async () => {
    try {
      // Pede permissão ao navegador para usar o microfone
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      
      mediaRecorderRef.current = new MediaRecorder(stream)
      chunksRef.current = []

      // Vai guardando os pedacinhos de áudio enquanto o usuário fala
      mediaRecorderRef.current.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }

      // Quando parar, junta tudo num arquivo só (Blob)
      mediaRecorderRef.current.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
        setAudioBlob(blob)
        // Desliga o microfone (apaga a luz vermelha da aba do navegador)
        stream.getTracks().forEach(track => track.stop()) 
      }

      mediaRecorderRef.current.start()
      setIsRecording(true)
      setAudioBlob(null) // Limpa o áudio anterior, se houver
    } catch (err) {
      console.error("Erro ao acessar microfone:", err)
      alert("Não foi possível acessar o microfone. Verifique as permissões do seu navegador.")
    }
  }, [])

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
    }
  }, [isRecording])

  const clearAudio = useCallback(() => {
    setAudioBlob(null)
    chunksRef.current = []
  }, [])

  return { isRecording, startRecording, stopRecording, audioBlob, clearAudio }
}