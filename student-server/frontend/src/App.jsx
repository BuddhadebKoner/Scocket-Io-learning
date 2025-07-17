import React, { useState, useEffect, useRef } from 'react'

const App = () => {
  const [gameState, setGameState] = useState('connecting')
  const [currentQuestion, setCurrentQuestion] = useState(null)
  const [selectedAnswer, setSelectedAnswer] = useState(null)
  const [feedback, setFeedback] = useState(null)
  const [results, setResults] = useState(null)
  const [studentId, setStudentId] = useState('')
  const [connectionStatus, setConnectionStatus] = useState('Connecting...')
  const [timeLeft, setTimeLeft] = useState(0)
  const [attemptsRemaining, setAttemptsRemaining] = useState(3)
  const [warning, setWarning] = useState('')
  const [currentAttemptAnswer, setCurrentAttemptAnswer] = useState(null)
  const wsRef = useRef(null)
  const timerRef = useRef(null)

  const WEBSOCKET_URL = import.meta.env.VITE_WEBSOCKET_URL || 'ws://localhost:3000'

  useEffect(() => {
    connectWebSocket()
    return () => {
      if (wsRef.current) {
        wsRef.current.close()
      }
      if (timerRef.current) {
        clearInterval(timerRef.current)
      }
    }
  }, [])

  const startTimer = (timeLimit) => {
    setTimeLeft(timeLimit)
    if (timerRef.current) {
      clearInterval(timerRef.current)
    }

    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current)
          return 0
        }
        return prev - 1
      })
    }, 1000)
  }

  const stopTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
    }
  }

  const connectWebSocket = () => {
    try {
      setConnectionStatus('Connecting...')
      wsRef.current = new WebSocket(WEBSOCKET_URL)

      wsRef.current.onopen = () => {
        setConnectionStatus('Connected')
        setGameState('welcome')
      }

      wsRef.current.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data)
          handleMessage(message)
        } catch (error) {
          console.error('Error parsing message:', error)
        }
      }

      wsRef.current.onclose = () => {
        setConnectionStatus('Disconnected')
        if (gameState !== 'results') {
          setGameState('error')
        }
      }

      wsRef.current.onerror = (error) => {
        console.error('WebSocket error:', error)
        setConnectionStatus('Connection Error')
        setGameState('error')
      }
    } catch (error) {
      console.error('Failed to connect:', error)
      setGameState('error')
    }
  }

  const handleMessage = (message) => {
    console.log('Received:', message)

    switch (message.type) {
      case 'welcome':
        setStudentId(message.studentId)
        setGameState('welcome')
        break

      case 'question':
        setCurrentQuestion(message)
        setSelectedAnswer(null)
        setCurrentAttemptAnswer(null)
        setFeedback(null)
        setAttemptsRemaining(message.maxAttempts || 3)
        setWarning('')
        setGameState('question')
        startTimer(message.timeLimit || 10)
        break

      case 'feedback':
        setFeedback(message)
        setGameState('feedback')
        stopTimer()
        break

      case 'results':
        setResults(message)
        setGameState('results')
        stopTimer()
        break

      case 'attempt-warning':
        setWarning(message.message)
        setCurrentAttemptAnswer(message.currentAnswer)
        setAttemptsRemaining(message.attemptsRemaining)
        break

      case 'warning':
        setWarning(message.message)
        break

      case 'timeout':
        setWarning(message.message)
        stopTimer()
        break

      case 'pong':
        console.log('Pong received')
        break

      default:
        console.log('Unknown message type:', message.type)
    }
  }

  const handleAnswerSelection = (answerIndex) => {
    setSelectedAnswer(answerIndex)

    // Send selection to server (this counts as an attempt)
    if (wsRef.current) {
      wsRef.current.send(JSON.stringify({
        type: 'answer',
        answerIndex: answerIndex
      }))
    }
  }

  const submitAnswer = () => {
    if (selectedAnswer !== null && wsRef.current) {
      wsRef.current.send(JSON.stringify({
        type: 'submit',
        answerIndex: selectedAnswer
      }))
    }
  }

  const startNewQuiz = () => {
    stopTimer()
    setWarning('')
    setCurrentAttemptAnswer(null)
    setAttemptsRemaining(3)
    if (wsRef.current) {
      wsRef.current.close()
    }
    connectWebSocket()
  }

  const renderConnecting = () => (
    <div className="text-center">
      <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
      <p className="text-gray-600">{connectionStatus}</p>
    </div>
  )

  const renderWelcome = () => (
    <div className="text-center">
      <h2 className="text-2xl font-bold text-green-600 mb-4">Welcome to MCQ Quiz!</h2>
      <p className="text-gray-600 mb-2">Student ID: {studentId}</p>
      <p className="text-gray-600">Quiz will start in a moment...</p>
    </div>
  )

  const renderQuestion = () => (
    <div>
      {/* Warning Messages */}
      {warning && (
        <div className="mb-4 p-3 bg-yellow-100 border border-yellow-400 text-yellow-700 rounded-lg">
          <p className="text-sm font-medium">{warning}</p>
        </div>
      )}

      <div className="mb-6">
        <div className="flex justify-between items-center mb-4">
          <span className="text-sm text-gray-500">
            Question {currentQuestion.questionNumber} of {currentQuestion.totalQuestions}
          </span>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-500">
              Attempts: {attemptsRemaining}/3
            </span>
            <span className={`text-sm px-3 py-1 rounded-full font-medium ${timeLeft <= 3 ? 'bg-red-100 text-red-800' :
              timeLeft <= 5 ? 'bg-yellow-100 text-yellow-800' :
                'bg-blue-100 text-blue-800'
              }`}>
              {timeLeft}s
            </span>
          </div>
        </div>
        <h2 className="text-xl font-semibold mb-6">{currentQuestion.question}</h2>
      </div>

      <div className="space-y-3 mb-6">
        {currentQuestion.options.map((option, index) => (
          <button
            key={index}
            onClick={() => handleAnswerSelection(index)}
            className={`w-full p-3 text-left rounded-lg border-2 transition-colors ${selectedAnswer === index
              ? 'border-blue-500 bg-blue-50'
              : currentAttemptAnswer === index
                ? 'border-orange-400 bg-orange-50'
                : 'border-gray-200 hover:border-gray-300'
              }`}
          >
            <span className="font-semibold mr-2">{String.fromCharCode(65 + index)}.</span>
            {option}
            {currentAttemptAnswer === index && (
              <span className="ml-2 text-xs text-orange-600">(Current selection)</span>
            )}
          </button>
        ))}
      </div>

      <button
        onClick={submitAnswer}
        disabled={selectedAnswer === null || timeLeft === 0}
        className="w-full bg-blue-500 text-white py-3 rounded-lg font-semibold disabled:bg-gray-300 disabled:cursor-not-allowed hover:bg-blue-600 transition-colors"
      >
        {selectedAnswer === null ? 'Select an Answer' :
          attemptsRemaining === 3 ? 'Submit Answer' :
            `Submit Answer (${attemptsRemaining} changes left)`}
      </button>

      {timeLeft <= 5 && timeLeft > 0 && (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-700 text-sm font-medium text-center">
            ⏰ Only {timeLeft} seconds remaining!
          </p>
        </div>
      )}
    </div>
  )

  const renderFeedback = () => (
    <div className="text-center">
      <div className="text-6xl mb-4 text-blue-500">
        ⏳
      </div>
      <h2 className="text-2xl font-bold text-blue-600 mb-4">
        {feedback.timedOut ? 'Time\'s Up!' :
          feedback.maxAttemptsReached ? 'Max Attempts Reached!' :
            'Answer Submitted!'}
      </h2>
      <p className="text-gray-600 mb-4">{feedback.explanation}</p>
      <p className="text-sm text-gray-500">Next question coming up...</p>
    </div>
  )

  const renderResults = () => (
    <div className="text-center">
      <h2 className="text-3xl font-bold text-blue-600 mb-6">Quiz Complete!</h2>

      {/* Score Summary */}
      <div className="bg-gray-50 p-6 rounded-lg mb-6">
        <div className="text-4xl font-bold text-blue-600 mb-2">
          {results.score}/{results.totalQuestions}
        </div>
        <div className="text-xl text-gray-600 mb-2">{results.percentage}%</div>
        <div className="text-sm text-gray-500">Time: {results.totalTime} seconds</div>
      </div>

      <p className="text-lg mb-6">{results.message}</p>

      {/* Detailed Answer Breakdown */}
      {results.answerBreakdown && (
        <div className="text-left bg-white border rounded-lg p-4 mb-6 max-h-96 overflow-y-auto">
          <h3 className="text-lg font-semibold mb-4 text-center">Answer Review</h3>
          {results.answerBreakdown.map((answer, index) => (
            <div key={index} className="mb-4 p-3 border-b border-gray-200 last:border-b-0">
              <div className="font-medium text-sm text-gray-600 mb-2">
                Question {answer.questionNumber}: {answer.question}
              </div>

              <div className="grid grid-cols-1 gap-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Your Answer:</span>
                  <span className={`font-medium ${answer.isCorrect ? 'text-green-600' : 'text-red-600'}`}>
                    {answer.yourAnswer}
                    {answer.isCorrect && ' ✓'}
                    {!answer.isCorrect && !answer.timedOut && ' ✗'}
                    {answer.timedOut && ' ⏰'}
                  </span>
                </div>

                <div className="flex justify-between">
                  <span className="text-gray-600">Correct Answer:</span>
                  <span className="font-medium text-green-600">{answer.correctAnswer}</span>
                </div>

                <div className="flex justify-between text-xs text-gray-500">
                  <span>Time: {answer.timeTaken}s</span>
                  <span>Attempts: {answer.attempts}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Summary Stats */}
      {results.summary && (
        <div className="grid grid-cols-2 gap-4 mb-6 text-sm">
          <div className="bg-green-50 p-3 rounded">
            <div className="text-green-800 font-semibold">Correct</div>
            <div className="text-green-600 text-xl">{results.summary.correct}</div>
          </div>
          <div className="bg-red-50 p-3 rounded">
            <div className="text-red-800 font-semibold">Incorrect</div>
            <div className="text-red-600 text-xl">{results.summary.incorrect}</div>
          </div>
        </div>
      )}

      <button
        onClick={startNewQuiz}
        className="bg-blue-500 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-600 transition-colors"
      >
        Take Quiz Again
      </button>
    </div>
  )

  const renderError = () => (
    <div className="text-center">
      <div className="text-red-500 text-6xl mb-4">⚠️</div>
      <h2 className="text-2xl font-bold text-red-600 mb-4">Connection Error</h2>
      <p className="text-gray-600 mb-6">Failed to connect to the quiz server.</p>
      <button
        onClick={connectWebSocket}
        className="bg-red-500 text-white px-6 py-3 rounded-lg font-semibold hover:bg-red-600 transition-colors"
      >
        Try Again
      </button>
    </div>
  )

  const renderContent = () => {
    switch (gameState) {
      case 'connecting':
        return renderConnecting()
      case 'welcome':
        return renderWelcome()
      case 'question':
        return renderQuestion()
      case 'feedback':
        return renderFeedback()
      case 'results':
        return renderResults()
      case 'error':
        return renderError()
      default:
        return renderConnecting()
    }
  }

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-lg p-8 w-full max-w-2xl">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-800">MCQ Quiz</h1>
          <div className={`px-3 py-1 rounded-full text-sm ${connectionStatus === 'Connected' ? 'bg-green-100 text-green-800' :
            connectionStatus === 'Connecting...' ? 'bg-yellow-100 text-yellow-800' :
              'bg-red-100 text-red-800'
            }`}>
            {connectionStatus}
          </div>
        </div>

        {renderContent()}
      </div>
    </div>
  )
}

export default App