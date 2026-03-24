import React, { useState } from 'react';
import { Brain, Lock, Mail, User, Calendar, Loader2 } from 'lucide-react';

function Register({ onToggleLogin }) {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    dob: '',
    age: '',
    gender: 'Other',
    country: ''
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      // Ensure age is a number and add username placeholder (Step 3 requirement)
      const submitData = {
        ...formData,
        age: formData.age ? parseInt(formData.age, 10) : 0,
        username: formData.email, // Use email as username if not provided
        country: formData.country || 'Not specified'
      };

      const response = await fetch(`${import.meta.env.VITE_API_URL}/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(submitData),
      });

      if (!response.ok) {
        const data = await response.json();
        // Handle FastAPI validation error arrays
        const errorMsg = Array.isArray(data.detail) 
          ? data.detail.map(err => err.msg).join(', ') 
          : (data.detail || 'Registration failed');
        throw new Error(errorMsg);
      }

      setSuccess(true);
      setTimeout(() => onToggleLogin(), 2000);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    let newFormData = { ...formData, [name]: value };
    
    if (name === 'dob' && value) {
      const birthDate = new Date(value);
      const today = new Date();
      let calculatedAge = today.getFullYear() - birthDate.getFullYear();
      const m = today.getMonth() - birthDate.getMonth();
      if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
        calculatedAge--;
      }
      if (!isNaN(calculatedAge)) {
        newFormData.age = calculatedAge.toString();
      }
    }
    
    setFormData(newFormData);
  };

  return (
    <div className="flex min-h-full flex-col justify-center px-6 py-12 lg:px-8 bg-[#f8fafc] animate-fade-in relative overflow-hidden">
      {/* Background Decor */}
      <div className="absolute top-0 right-0 w-[48rem] h-[32rem] bg-indigo-200/20 rounded-full blur-[120px] -translate-y-1/2 translate-x-1/2"></div>
      
      <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10 text-center">
        <h2 className="text-3xl font-extrabold leading-9 tracking-tight text-slate-900 mb-2">Create New Account</h2>
        <p className="text-sm text-slate-800 italic">Join the Tremora analysis platform</p>
      </div>

      <div className="mt-10 sm:mx-auto sm:w-full sm:max-w-lg relative z-10">
        <div className="bg-white border border-slate-200 p-10 rounded-3xl shadow-xl">
          
          {success ? (
            <div className="text-center py-10 animate-bounce">
              <div className="w-16 h-16 bg-emerald-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <User className="text-white w-8 h-8" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-2">Account Created!</h3>
              <p className="text-slate-600">Redirecting to login...</p>
            </div>
          ) : (
            <form className="space-y-4" onSubmit={handleSubmit}>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1 ml-1 uppercase tracking-wider">Full Name</label>
                  <div className="relative">
                    <input name="name" required onChange={handleChange} value={formData.name} className="block w-full rounded-xl bg-slate-50 py-3 pl-11 text-slate-900 ring-1 ring-slate-200 focus:ring-2 focus:ring-sky-500 transition-all text-sm" placeholder="John Doe" />
                    <User className="absolute left-4 top-3.5 w-4 h-4 text-slate-700" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1 ml-1 uppercase tracking-wider">Email Address</label>
                  <div className="relative">
                    <input name="email" type="email" required onChange={handleChange} value={formData.email} className="block w-full rounded-xl bg-slate-50 py-3 pl-11 text-slate-900 ring-1 ring-slate-200 focus:ring-2 focus:ring-sky-500 transition-all text-sm" placeholder="john@example.com" />
                    <Mail className="absolute left-4 top-3.5 w-4 h-4 text-slate-700" />
                  </div>
                </div>
              </div>

              <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1 ml-1 uppercase tracking-wider">Secure Password</label>
                <div className="relative">
                  <input name="password" type="password" required onChange={handleChange} value={formData.password} className="block w-full rounded-xl bg-slate-50 py-3 pl-11 text-slate-900 ring-1 ring-slate-200 focus:ring-2 focus:ring-sky-500 transition-all text-sm" placeholder="••••••••" />
                  <Lock className="absolute left-4 top-3.5 w-4 h-4 text-slate-700" />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1 ml-1 uppercase tracking-wider">DOB</label>
                  <input name="dob" type="date" onChange={handleChange} value={formData.dob} className="block w-full rounded-xl bg-slate-50 py-3 px-3 text-slate-900 ring-1 ring-slate-200 focus:ring-2 focus:ring-sky-500 transition-all text-sm cursor-pointer" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1 ml-1 uppercase tracking-wider">Age</label>
                  <input name="age" type="number" onChange={handleChange} value={formData.age} className="block w-full rounded-xl bg-slate-50 py-3 px-4 text-slate-900 ring-1 ring-slate-200 focus:ring-2 focus:ring-sky-500 transition-all text-sm" placeholder="25" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1 ml-1 uppercase tracking-wider">Gender</label>
                  <select name="gender" onChange={handleChange} value={formData.gender} className="block w-full rounded-xl bg-slate-50 py-3 px-3 text-slate-900 ring-1 ring-slate-200 focus:ring-2 focus:ring-sky-500 transition-all text-sm cursor-pointer border-r-8 border-transparent">
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>

              {error && <div className="p-3 bg-red-500/10 border border-red-500/50 rounded-xl text-red-500 text-xs">{error}</div>}

              <button
                type="submit"
                disabled={isLoading}
                className="w-full flex justify-center items-center py-4 bg-gradient-to-r from-sky-500 to-indigo-500 text-white rounded-xl text-sm font-bold shadow-lg shadow-sky-500/20 hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50"
              >
                {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Register Experience'}
              </button>
            </form>
          )}

          <p className="mt-8 text-center text-sm text-slate-700">
            Already have an account?{' '}
            <button onClick={onToggleLogin} className="font-semibold text-sky-600 hover:text-sky-500 font-sans">Log In</button>
          </p>
        </div>
      </div>
    </div>
  );
}

export default Register;
