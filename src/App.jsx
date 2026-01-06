import React, { useState, useEffect } from 'react';
import { Client, Account, Databases, Query } from 'appwrite';


const client = new Client()
    .setEndpoint(import.meta.env.VITE_APPWRITE_ENDPOINT)
    .setProject(import.meta.env.VITE_APPWRITE_PROJECT_ID);

const account = new Account(client);
const databases = new Databases(client);

const DATABASE_ID = import.meta.env.VITE_APPWRITE_DATABASE_ID;
const COLLECTION_ID = import.meta.env.VITE_APPWRITE_COLLECTION_ID;

function App() {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [username, setUsername] = useState('');
    const [error, setError] = useState('');
    const [myScores, setMyScores] = useState([]);
    const [friendScores, setFriendScores] = useState([]);
    const [showAddScore, setShowAddScore] = useState(false);
    const [editingScore, setEditingScore] = useState(null);
    const [newScore, setNewScore] = useState({
        listening: '',
        reading: '',
        writing: ''
    });
    const [viewMode, setViewMode] = useState('my');

    useEffect(() => {
        checkUser();
    }, []);

    useEffect(() => {
        if (user) {
            fetchAllScores();
        }
    }, [user]);

    const checkUser = async () => {
        try {
            const currentUser = await account.get();
            setUser(currentUser);
        } catch (err) {
            setUser(null);
        } finally {
            setLoading(false);
        }
    };

    const handleLogin = async () => {
        setError('');
        setLoading(true);

        const user1 = import.meta.env.VITE_USER1;
        const user2 = import.meta.env.VITE_USER2;
        const password = import.meta.env.VITE_PASSWORD

        let email;
        if (username === "kumush") {
            email = user1;
        } else if (username === "ezoza") {
            email = user2;
        } else {
            setError("Login failed! Invalid credentials!");
            setLoading(false);
            return
        }

        try {
            await account.createEmailPasswordSession(email, password);
            const currentUser = await account.get();
            setUser(currentUser);
            setUsername("");
        } catch (err) {
            setError(err.message || 'Login failed. Please check your credentials.');
        } finally {
            setLoading(false);
        }
    };

    const handleLogout = async () => {
        try {
            await account.deleteSession('current');
            setUser(null);
            setMyScores([]);
            setFriendScores([]);
        } catch (err) {
            console.error('Logout error:', err);
        }
    };

    const fetchAllScores = async () => {
        try {
            // Fetch all scores
            const response = await databases.listDocuments(
                DATABASE_ID,
                COLLECTION_ID,
                [
                    Query.orderDesc('$createdAt'),
                    Query.limit(100)
                ]
            );

            // Separate my scores and friend's scores
            const mine = response.documents.filter(doc => doc.userId === user.$id);
            const friend = response.documents.filter(doc => doc.userId !== user.$id);

            setMyScores(mine);
            setFriendScores(friend);
        } catch (err) {
            console.error('Error fetching scores:', err);
        }
    };

    const handleAddScore = async () => {
        setError('');

        const listening = parseInt(newScore.listening);
        const reading = parseInt(newScore.reading);
        const writing = parseFloat(newScore.writing);

        if (isNaN(listening) || isNaN(reading)) {
            setError('Please enter valid scores for Listening and Reading');
            return;
        }

        if (listening < 0 || listening > 40 || reading < 0 || reading > 40) {
            setError('Listening and Reading scores must be between 0 and 40');
            return;
        }

        if (newScore.writing && (writing < 0 || writing > 9)) {
            setError('Writing score must be between 0 and 9');
            return;
        }

        try {
            if (editingScore) {
                // Update existing score
                await databases.updateDocument(
                    DATABASE_ID,
                    COLLECTION_ID,
                    editingScore.$id,
                    {
                        listening: listening,
                        reading: reading,
                        writing: writing || 0
                    }
                );
            } else {
                // Create new score
                await databases.createDocument(
                    DATABASE_ID,
                    COLLECTION_ID,
                    'unique()',
                    {
                        userId: user.$id,
                        listening: listening,
                        reading: reading,
                        writing: writing || 0,
                        day: myScores.length + 1
                    }
                );
            }

            setNewScore({ listening: '', reading: '', writing: '' });
            setShowAddScore(false);
            setEditingScore(null);
            fetchAllScores();
        } catch (err) {
            setError(err.message || 'Failed to save score');
        }
    };

    const handleEditScore = (score) => {
        setEditingScore(score);
        setNewScore({
            listening: score.listening.toString(),
            reading: score.reading.toString(),
            writing: score.writing > 0 ? score.writing.toString() : ''
        });
        setShowAddScore(true);
    };

    const calculateStats = (scores) => {
        if (scores.length === 0) return { avgListening: 0, avgReading: 0, avgWriting: 0, total: 0 };

        const total = scores.length;
        const avgListening = (scores.reduce((sum, s) => sum + s.listening, 0) / total).toFixed(1);
        const avgReading = (scores.reduce((sum, s) => sum + s.reading, 0) / total).toFixed(1);
        const writingScores = scores.filter(s => s.writing > 0);
        const avgWriting = writingScores.length > 0
            ? (writingScores.reduce((sum, s) => sum + s.writing, 0) / writingScores.length).toFixed(1)
            : 0;

        return { avgListening, avgReading, avgWriting, total };
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center">
                <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-white"></div>
            </div>
        );
    }

    if (!user) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center p-4">
                <div className="bg-white rounded-3xl shadow-2xl p-8 w-full max-w-md">
                    <div className="text-center mb-8">
                        <h1 className="text-4xl font-bold text-gray-800 mb-2">IELTS Tracker</h1>
                        <p className="text-gray-600">30-Day Challenge</p>
                    </div>

                    <div className="space-y-6">
                        {error && (
                            <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded">
                                <p className="text-red-700 text-sm">{error}</p>
                            </div>
                        )}

                        <div>
                            <label className="block text-gray-700 text-sm font-semibold mb-2">
                                Email
                            </label>
                            <input
                                type="text"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-indigo-500 focus:outline-none transition"
                                placeholder="your name"
                            />
                        </div>

                        <button
                            onClick={handleLogin}
                            disabled={loading}
                            className="w-full bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-bold py-3 rounded-xl hover:shadow-lg transform hover:scale-105 transition duration-200 disabled:opacity-50"
                        >
                            {loading ? 'Logging in...' : 'Login'}
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    const myStats = calculateStats(myScores);
    const friendStats = calculateStats(friendScores);
    const displayScores = viewMode === 'my' ? myScores : friendScores;
    const displayStats = viewMode === 'my' ? myStats : friendStats;

    let currentName, friendName;
    if (user.name === "Kumush") {
      currentName = "Kumush";
      friendName = "Ezoza";
    } else {
      currentName = "Ezoza";
      friendName = "Kumush";
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 p-4 pb-20">
            <div className="max-w-2xl mx-auto">
                {/* Header */}
                <div className="bg-white rounded-3xl shadow-xl p-6 mb-6">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <h1 className="text-2xl font-bold text-gray-800">IELTS Challenge</h1>
                            <h2 className="text-xl font-bold text-gray-700">{user.name}</h2>
                            <p className="text-gray-600 text-sm">Day {myScores.length}/30</p>
                        </div>
                        <button
                            onClick={handleLogout}
                            className="bg-red-500 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-red-600 transition"
                        >
                            Logout
                        </button>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full bg-gray-200 rounded-full h-3 mb-2">
                        <div
                            className="bg-gradient-to-r from-green-400 to-blue-500 h-3 rounded-full transition-all duration-500"
                            style={{ width: `${(myScores.length / 30) * 100}%` }}
                        ></div>
                    </div>
                    <p className="text-xs text-gray-500 text-right">{Math.round((myScores.length / 30) * 100)}% Complete</p>
                </div>

                {/* View Mode Tabs */}
                <div className="bg-white rounded-2xl shadow-xl p-2 mb-6 flex gap-2">
                    <button
                        onClick={() => setViewMode('my')}
                        className={`flex-1 py-2 px-4 rounded-xl font-semibold text-sm transition ${
                            viewMode === 'my'
                                ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white'
                                : 'text-gray-600 hover:bg-gray-100'
                        }`}
                    >
                        {currentName}'s Stats
                    </button>
                    <button
                        onClick={() => setViewMode('friend')}
                        className={`flex-1 py-2 px-4 rounded-xl font-semibold text-sm transition ${
                            viewMode === 'friend'
                                ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white'
                                : 'text-gray-600 hover:bg-gray-100'
                        }`}
                    >
                        {friendName}'s Stats
                    </button>
                    <button
                        onClick={() => setViewMode('compare')}
                        className={`flex-1 py-2 px-4 rounded-xl font-semibold text-sm transition ${
                            viewMode === 'compare'
                                ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white'
                                : 'text-gray-600 hover:bg-gray-100'
                        }`}
                    >
                        Compare
                    </button>
                </div>

                {/* Compare View */}
                {viewMode === 'compare' ? (
                    <div className="space-y-4 mb-6">
                        {/* Listening Comparison */}
                        <div className="bg-white rounded-2xl shadow-lg p-5">
                            <div className="flex items-center justify-between mb-3">
                                <span className="text-lg font-bold text-gray-800">👂 Listening</span>
                                <span className="text-xs text-gray-500">/40</span>
                            </div>
                            <div className="space-y-3">
                                <div>
                                    <div className="flex justify-between items-center mb-1">
                                        <span className="text-sm text-gray-600">{currentName}</span>
                                        <span className="text-lg font-bold text-indigo-600">{myStats.avgListening}</span>
                                    </div>
                                    <div className="w-full bg-gray-200 rounded-full h-2">
                                        <div
                                            className="bg-indigo-500 h-2 rounded-full transition-all duration-500"
                                            style={{ width: `${(myStats.avgListening / 40) * 100}%` }}
                                        ></div>
                                    </div>
                                </div>
                                <div>
                                    <div className="flex justify-between items-center mb-1">
                                        <span className="text-sm text-gray-600">{friendName}</span>
                                        <span className="text-lg font-bold text-purple-600">{friendStats.avgListening}</span>
                                    </div>
                                    <div className="w-full bg-gray-200 rounded-full h-2">
                                        <div
                                            className="bg-purple-500 h-2 rounded-full transition-all duration-500"
                                            style={{ width: `${(friendStats.avgListening / 40) * 100}%` }}
                                        ></div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Reading Comparison */}
                        <div className="bg-white rounded-2xl shadow-lg p-5">
                            <div className="flex items-center justify-between mb-3">
                                <span className="text-lg font-bold text-gray-800">📖 Reading</span>
                                <span className="text-xs text-gray-500">/40</span>
                            </div>
                            <div className="space-y-3">
                                <div>
                                    <div className="flex justify-between items-center mb-1">
                                        <span className="text-sm text-gray-600">{currentName}</span>
                                        <span className="text-lg font-bold text-indigo-600">{myStats.avgReading}</span>
                                    </div>
                                    <div className="w-full bg-gray-200 rounded-full h-2">
                                        <div
                                            className="bg-indigo-500 h-2 rounded-full transition-all duration-500"
                                            style={{ width: `${(myStats.avgReading / 40) * 100}%` }}
                                        ></div>
                                    </div>
                                </div>
                                <div>
                                    <div className="flex justify-between items-center mb-1">
                                        <span className="text-sm text-gray-600">{friendName}</span>
                                        <span className="text-lg font-bold text-purple-600">{friendStats.avgReading}</span>
                                    </div>
                                    <div className="w-full bg-gray-200 rounded-full h-2">
                                        <div
                                            className="bg-purple-500 h-2 rounded-full transition-all duration-500"
                                            style={{ width: `${(friendStats.avgReading / 40) * 100}%` }}
                                        ></div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Writing Comparison */}
                        <div className="bg-white rounded-2xl shadow-lg p-5">
                            <div className="flex items-center justify-between mb-3">
                                <span className="text-lg font-bold text-gray-800">✍️ Writing</span>
                                <span className="text-xs text-gray-500">/9</span>
                            </div>
                            <div className="space-y-3">
                                <div>
                                    <div className="flex justify-between items-center mb-1">
                                        <span className="text-sm text-gray-600">{currentName}</span>
                                        <span className="text-lg font-bold text-indigo-600">{myStats.avgWriting}</span>
                                    </div>
                                    <div className="w-full bg-gray-200 rounded-full h-2">
                                        <div
                                            className="bg-indigo-500 h-2 rounded-full transition-all duration-500"
                                            style={{ width: `${(myStats.avgWriting / 9) * 100}%` }}
                                        ></div>
                                    </div>
                                </div>
                                <div>
                                    <div className="flex justify-between items-center mb-1">
                                        <span className="text-sm text-gray-600">{friendName}</span>
                                        <span className="text-lg font-bold text-purple-600">{friendStats.avgWriting}</span>
                                    </div>
                                    <div className="w-full bg-gray-200 rounded-full h-2">
                                        <div
                                            className="bg-purple-500 h-2 rounded-full transition-all duration-500"
                                            style={{ width: `${(friendStats.avgWriting / 9) * 100}%` }}
                                        ></div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Days Logged */}
                        <div className="bg-white rounded-2xl shadow-lg p-5">
                            <div className="flex items-center justify-between mb-3">
                                <span className="text-lg font-bold text-gray-800">📊 Progress</span>
                                <span className="text-xs text-gray-500">Days</span>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="text-center p-3 bg-indigo-50 rounded-xl">
                                    <p className="text-sm text-gray-600 mb-1">You</p>
                                    <p className="text-3xl font-bold text-indigo-600">{myStats.total}</p>
                                </div>
                                <div className="text-center p-3 bg-purple-50 rounded-xl">
                                    <p className="text-sm text-gray-600 mb-1">Friend</p>
                                    <p className="text-3xl font-bold text-purple-600">{friendStats.total}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                ) : (
                    <>
                        {/* Stats Cards */}
                        <div className="grid grid-cols-2 gap-4 mb-6">
                            <div className="bg-white rounded-2xl shadow-lg p-4">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-2xl">👂</span>
                                    <span className="text-xs font-semibold text-gray-500">AVG</span>
                                </div>
                                <p className="text-3xl font-bold text-indigo-600">{displayStats.avgListening}</p>
                                <p className="text-xs text-gray-600">Listening /40</p>
                            </div>

                            <div className="bg-white rounded-2xl shadow-lg p-4">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-2xl">📖</span>
                                    <span className="text-xs font-semibold text-gray-500">AVG</span>
                                </div>
                                <p className="text-3xl font-bold text-purple-600">{displayStats.avgReading}</p>
                                <p className="text-xs text-gray-600">Reading /40</p>
                            </div>

                            <div className="bg-white rounded-2xl shadow-lg p-4">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-2xl">✍️</span>
                                    <span className="text-xs font-semibold text-gray-500">AVG</span>
                                </div>
                                <p className="text-3xl font-bold text-pink-600">{displayStats.avgWriting}</p>
                                <p className="text-xs text-gray-600">Writing /9</p>
                            </div>

                            <div className="bg-white rounded-2xl shadow-lg p-4">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-2xl">📊</span>
                                    <span className="text-xs font-semibold text-gray-500">TOTAL</span>
                                </div>
                                <p className="text-3xl font-bold text-green-600">{displayStats.total}</p>
                                <p className="text-xs text-gray-600">Days Logged</p>
                            </div>
                        </div>
                    </>
                )}

                {/* Add Score Button - only show for "My Stats" view */}
                {viewMode === 'my' && !showAddScore && myScores.length < 30 && (
                    <button
                        onClick={() => setShowAddScore(true)}
                        className="w-full bg-gradient-to-r from-green-400 to-blue-500 text-white font-bold py-4 rounded-2xl shadow-lg hover:shadow-xl transform hover:scale-105 transition duration-200 mb-6"
                    >
                        + Add Today's Score
                    </button>
                )}

                {/* Add/Edit Score Form */}
                {showAddScore && (
                    <div className="bg-white rounded-3xl shadow-xl p-6 mb-6">
                        <h2 className="text-xl font-bold text-gray-800 mb-4">
                            {editingScore ? 'Edit Score' : `Day ${myScores.length + 1}`}
                        </h2>
                        <div className="space-y-4">
                            {error && (
                                <div className="bg-red-50 border-l-4 border-red-500 p-3 rounded">
                                    <p className="text-red-700 text-sm">{error}</p>
                                </div>
                            )}

                            <div>
                                <label className="block text-gray-700 text-sm font-semibold mb-2">
                                    👂 Listening (0-40)
                                </label>
                                <input
                                    type="number"
                                    min="0"
                                    max="40"
                                    value={newScore.listening}
                                    onChange={(e) => setNewScore({ ...newScore, listening: e.target.value })}
                                    className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-indigo-500 focus:outline-none transition"
                                    placeholder="28"
                                />
                            </div>

                            <div>
                                <label className="block text-gray-700 text-sm font-semibold mb-2">
                                    📖 Reading (0-40)
                                </label>
                                <input
                                    type="number"
                                    min="0"
                                    max="40"
                                    value={newScore.reading}
                                    onChange={(e) => setNewScore({ ...newScore, reading: e.target.value })}
                                    className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-purple-500 focus:outline-none transition"
                                    placeholder="32"
                                />
                            </div>

                            <div>
                                <label className="block text-gray-700 text-sm font-semibold mb-2">
                                    ✍️ Writing (0-9) - Optional
                                </label>
                                <input
                                    type="number"
                                    min="0"
                                    max="9"
                                    step="0.5"
                                    value={newScore.writing}
                                    onChange={(e) => setNewScore({ ...newScore, writing: e.target.value })}
                                    className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-pink-500 focus:outline-none transition"
                                    placeholder="7.5"
                                />
                            </div>

                            <div className="flex gap-3">
                                <button
                                    onClick={() => {
                                        setShowAddScore(false);
                                        setEditingScore(null);
                                        setNewScore({ listening: '', reading: '', writing: '' });
                                        setError('');
                                    }}
                                    className="flex-1 bg-gray-200 text-gray-700 font-semibold py-3 rounded-xl hover:bg-gray-300 transition"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleAddScore}
                                    className="flex-1 bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-semibold py-3 rounded-xl hover:shadow-lg transition"
                                >
                                    {editingScore ? 'Update Score' : 'Save Score'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Scores History - only show for individual views */}
                {viewMode !== 'compare' && (
                    <div className="bg-white rounded-3xl shadow-xl p-6">
                        <h2 className="text-xl font-bold text-gray-800 mb-4">
                            {viewMode === 'my' ? 'Your Journey' : "Friend's Journey"}
                        </h2>
                        {displayScores.length === 0 ? (
                            <div className="text-center py-8">
                                <p className="text-gray-500 text-sm">No scores yet. {viewMode === 'my' ? 'Start your challenge today!' : 'Waiting for scores...'} 🚀</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {displayScores.map((score, index) => (
                                    <div
                                        key={score.$id}
                                        className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl p-4 border-l-4 border-indigo-500"
                                    >
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="font-bold text-gray-800">Day {displayScores.length - index}</span>
                                            <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500">
                          {new Date(score.$createdAt).toLocaleDateString()}
                        </span>
                                                {viewMode === 'my' && (
                                                    <button
                                                        onClick={() => handleEditScore(score)}
                                                        className="text-indigo-600 hover:text-indigo-800 text-xs font-semibold"
                                                    >
                                                        Edit
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-3 gap-2 text-sm">
                                            <div>
                                                <p className="text-gray-600 text-xs">👂 Listening</p>
                                                <p className="font-bold text-indigo-600">{score.listening}/40</p>
                                            </div>
                                            <div>
                                                <p className="text-gray-600 text-xs">📖 Reading</p>
                                                <p className="font-bold text-purple-600">{score.reading}/40</p>
                                            </div>
                                            <div>
                                                <p className="text-gray-600 text-xs">✍️ Writing</p>
                                                <p className="font-bold text-pink-600">
                                                    {score.writing > 0 ? `${score.writing}/9` : '-'}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

export default App;