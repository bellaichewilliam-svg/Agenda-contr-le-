import numpy as np, wave, subprocess
SR=48000; DUR=10.0
n=int(SR*DUR); mix=np.zeros(n)
rng=np.random.default_rng(1)
def add(sig,t,g):
    i=int(t*SR); j=min(n,i+len(sig)); mix[i:j]+=sig[:j-i]*g
def whoosh(d=0.45):
    m=int(d*SR); x=rng.standard_normal(m); t=np.linspace(0,1,m)
    # moving one-pole lowpass, cutoff sweeping up then down
    fc=300+4000*np.sin(np.pi*t)**2; a=np.exp(-2*np.pi*fc/SR); y=np.zeros(m); p=0
    for k in range(m): p=a[k]*p+(1-a[k])*x[k]; y[k]=p
    env=np.sin(np.pi*t)**1.5; return y*env/np.abs(y).max()
def pop():
    m=int(0.12*SR); t=np.arange(m)/SR; f=900*np.exp(-t*25)+250
    return np.sin(2*np.pi*np.cumsum(f)/SR)*np.exp(-t*40)
def ding(f,d=0.9):
    m=int(d*SR); t=np.arange(m)/SR
    return (np.sin(2*np.pi*f*t)+0.4*np.sin(2*np.pi*f*2*t)+0.15*np.sin(2*np.pi*f*3.01*t))*np.exp(-t*5)*np.minimum(1,t*400)
def impact():
    m=int(0.6*SR); t=np.arange(m)/SR
    return (np.sin(2*np.pi*(60+80*np.exp(-t*20))*t)*np.exp(-t*7))+0.3*rng.standard_normal(m)*np.exp(-t*30)
add(pop(),0.1,0.35); add(whoosh(),0.3,0.30); add(whoosh(0.35),0.72,0.15)
add(whoosh(),2.5,0.25); add(pop(),2.8,0.35); add(pop(),3.05,0.4)
add(whoosh(0.5),3.95,0.30); add(ding(1318.5),4.15,0.22); add(whoosh(0.35),4.55,0.15)
add(whoosh(0.6),7.35,0.35); add(impact(),7.82,0.55); add(pop(),7.85,0.4)
for k,f in enumerate([1046.5,1318.5,1568.0,2093.0]): add(ding(f,1.2),8.25+k*0.13,0.18)
mix=np.clip(mix,-1,1)
w=wave.open('sfx.wav','wb'); w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
w.writeframes((mix*32767).astype(np.int16).tobytes()); w.close()
