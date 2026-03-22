export const TYPING_PROMPTS = [
  "Parkinson's disease is a neurodegenerative disorder that mainly affects the motor system. The symptoms generally come on slowly over time. Early in the disease, the most obvious are shaking, rigidity, slowness of movement, and difficulty with walking. Thinking and behavioral problems may also occur. Dementia becomes common in the advanced stages of the disease. Depression and anxiety are also common, occurring in more than a third of people with Parkinson's disease.",

  "Digital biomarkers represent a transformative leap in modern medicine, especially within neurology where subtle changes in movement can signal disease years before clinical symptoms appear. By analyzing the precise timing between keystrokes, known as inter-key intervals, researchers can identify patterns of motor dysfunction. This non-invasive approach allows for continuous monitoring of a patient's health in their own home, providing far more data than a periodic visit to a clinic could ever offer.",

  "The study of keystroke dynamics is rooted in the belief that the unique way we interact with a keyboard reveals deep insights into our neuromuscular health. Every press and release of a key is a complex sequence of motor commands initiated in the brain and executed by the hands. In healthy individuals, these sequences are fluid and rhythmic. However, in those with early-stage tremors or rigidity, these timings begin to drift, creating tiny, high-frequency fluctuations that machine learning models can detect with high precision.",

  "Telemedicine and remote patient monitoring have become essential tools in the management of chronic neurological conditions. For patients living in rural or underserved areas, accessing specialized neurological care can be a significant challenge. By using everyday devices like laptops and smartphones to collect health data, we can bridge this gap. This technology empowers both patients and clinicians to detect changes in symptoms earlier, leading to more personalized and effective treatment plans that improve quality of life."
];

export const getRandomPrompt = () => {
  const randomIndex = Math.floor(Math.random() * TYPING_PROMPTS.length);
  return TYPING_PROMPTS[randomIndex];
};
