"""Deterministically generate five original, self-contained SVG backgrounds. No external assets or font files."""
from pathlib import Path
import random
R=random.Random(31415)
out=Path(__file__).parent
base='''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 1000" preserveAspectRatio="xMidYMid slice"><defs>
<linearGradient id="sky" x2="0" y2="1"><stop stop-color="{top}"/><stop offset="1" stop-color="{bottom}"/></linearGradient>
<radialGradient id="v"><stop stop-color="#ffffff" stop-opacity=".06"/><stop offset="1" stop-color="#000000" stop-opacity=".66"/></radialGradient>
<pattern id="grain" width="96" height="96" patternUnits="userSpaceOnUse"><circle cx="9" cy="18" r="1" fill="{grain}" opacity=".22"/><circle cx="41" cy="79" r="1.5" fill="{grain}" opacity=".13"/><path d="M0 0l96 96 M-35 30l40 40" stroke="{grain}" opacity=".045"/></pattern>
</defs><rect width="1600" height="1000" fill="url(#sky)"/>{foreground}<rect width="1600" height="1000" fill="url(#grain)"/><rect width="1600" height="1000" fill="url(#v)"/></svg>'''
def peaks(y,amp,fill,points=12):
    coords=[(-100,1000),(-100,y)]
    for i in range(points+2):
        x=i*170-150; yy=y-R.randint(0,amp)
        coords.append((x, yy))
    coords.extend([(1700,1000)])
    return '<polygon points="'+" ".join(f'{x},{yy}' for x,yy in coords)+f'" fill="{fill}"/>'
def trees():
    ans=[]
    for x in range(15,1690,31):
        yy=R.randint(640,840); h=R.randint(105,240)
        ans.append(f'<path d="M{x} {yy} L{x-24} {yy} L{x} {yy-h} L{x+24} {yy}Z" fill="#101c19" opacity=".52"/>')
    return ''.join(ans)
def rings():
    st=['<g fill="none" stroke="#9a8c73" opacity=".19">']
    for r in (140,182,238,340,430):
        st.append(f'<circle cx="800" cy="495" r="{r}" stroke-width="1.2"/>')
    for i in range(24):
        a=i*3.14159/12
        import math
        x1,y1=800+230*math.cos(a),495+230*math.sin(a)
        x2,y2=800+439*math.cos(a),495+439*math.sin(a)
        st.append(f'<path d="M{x1:.1f},{y1:.1f} L{x2:.1f},{y2:.1f}"/>')
    st.append('</g>')
    return ''.join(st)
assets={
 'ember':('#1a1c20','#39302c', '<circle cx="1190" cy="260" r="94" fill="#8b6353" opacity=".14"/>'+peaks(570,190,'#242526')+peaks(714,180,'#1b2023')+'<path d="M0 880 Q330 810 680 865 T1600 820 V1000 H0Z" fill="#16191b"/><path d="M760 890 L785 665 L805 665 L829 890" stroke="#766051" stroke-width="4" opacity=".4"/><path d="M715 770L788 660L859 770Z" fill="#75614f" opacity=".32"/>' ),
 'thorn':('#182325','#2b3730', '<circle cx="1250" cy="212" r="64" fill="#afbaa1" opacity=".11"/>'+peaks(550,165,'#22302c')+trees()+'<path d="M0 950Q650 750 1600 920V1000H0Z" fill="#131e1d"/>' ),
 'astral':('#181a29','#26293a', rings()+'<g stroke="#a6a9be" opacity=".19" fill="none"><path d="M50 400L230 260L460 360L600 90L980 270L1210 110L1550 320"/><path d="M200 700L490 480L720 670L1050 490L1410 810"/></g>'+''.join(f'<circle cx="{R.randint(0,1600)}" cy="{R.randint(0,1000)}" r="1.1" fill="#d6d6dd" opacity=".38"/>' for i in range(90))),
 'infernal':('#26191b','#38211f', rings().replace('#9a8c73','#bd685a')+peaks(610,130,'#2b2022')+peaks(780,170,'#1e181c')+'<g fill="none" stroke="#b36052" stroke-width="3" opacity=".13"><path d="M0 200L450 540L700 200L1020 750L1600 120"/><path d="M200 1000L740 330L890 690L1500 1000"/></g>'),
 'parchment':('#3a332a','#453d32',rings().replace('#9a8c73','#c9ae80')+'<g stroke="#b2a18a" opacity=".12" fill="none"><path d="M-200 450L1700 450 M800 -100L800 1100 M0 1000L1600 0 M0 0L1600 1000"/></g>'+peaks(720,150,'#3f392f')),
}
for key,(top,bottom,foreground) in assets.items():
    (out/f'{key}.svg').write_text(base.format(top=top,bottom=bottom,grain='#c0b7a7',foreground=foreground))
