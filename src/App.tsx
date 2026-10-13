import { LiveSystem } from './components/LiveSystem'
import { LostUpdateLab } from './components/LostUpdateLab'
import { CacheLab } from './components/CacheLab'
import { FlowLockLab } from './components/FlowLockLab'
import { OrderingLab } from './components/OrderingLab'
import { CronLab } from './components/CronLab'
import { FloodLab } from './components/FloodLab'
import { jobs, profile, skills } from './data/profile'

export default function App() {
  return (
    <>
      <a className="skip" href="#main">
        Skip to content
      </a>
      <header className="top">
        <a href="#main" className="top-name">
          {profile.name}
        </a>
        <nav aria-label="Sections">
          <a href="#labs">Labs</a>
          <a href="#work">Work</a>
          <a href="#stack">Stack</a>
          <a href="#contact">Contact</a>
        </nav>
      </header>

      <main id="main">
        <section className="hero sheet">
          <h1>
            Nguyen
            <br />
            Quang Huy
          </h1>
          <p className="hero-lede">
            Senior backend engineer in Ho Chi Minh City. For six years I have built payment and
            trade systems that stay correct when requests retry, race and crash.
          </p>
          <p className="hero-invite">
            Below is the kind of payment pipeline I built in fintech, running in your browser. Try
            to make it lose a payment.
          </p>
          <LiveSystem />
        </section>

        <section id="labs" className="sheet">
          <h2>Six problems I get paid to prevent</h2>
          <p className="section-lede">
            All of them pass a single-user test and only appear under concurrency or load. Solving
            them was my job in fintech and in bot services. Flip the strategy and run each one.
          </p>
          <div className="labs">
            <LostUpdateLab />
            <CacheLab />
            <FlowLockLab />
            <OrderingLab />
            <CronLab />
            <FloodLab />
          </div>
        </section>

        <section id="work" className="sheet">
          <h2>Work log</h2>
          <p className="section-lede">Append-only. Newest entry first.</p>
          <ol className="log" reversed>
            {jobs.map((job, i) => (
              <li key={job.company} className="entry">
                <div className="entry-meta">
                  <span className="entry-offset">offset {jobs.length - 1 - i}</span>
                  <span className="entry-dates">
                    {job.from} to {job.to}
                  </span>
                </div>
                <div className="entry-body">
                  <h3>
                    {job.company}
                    <span className="entry-role">
                      {job.title ? `${job.title}, ${job.domain}` : job.domain}
                    </span>
                  </h3>
                  <p className="entry-summary">{job.summary}</p>
                  <dl className="entry-points">
                    {job.points.map((point) => (
                      <div key={point.topic}>
                        <dt>{point.topic}</dt>
                        <dd>{point.text}</dd>
                      </div>
                    ))}
                  </dl>
                  <ul className="tags" aria-label="Technologies">
                    {job.stack.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              </li>
            ))}
          </ol>
          <p className="education">
            Bachelor of Software Engineering, Thu Dau Mot University, 2016 to 2020.
          </p>
        </section>

        <section id="stack" className="sheet">
          <h2>Stack, with receipts</h2>
          <p className="section-lede">What I use, and where I used it under real load.</p>
          <div className="table-scroll">
            <table className="ledger">
              <thead>
                <tr>
                  <th scope="col">Area</th>
                  <th scope="col">Tools and patterns</th>
                  <th scope="col">Where it was used</th>
                </tr>
              </thead>
              <tbody>
                {skills.map((row) => (
                  <tr key={row.area}>
                    <th scope="row">{row.area}</th>
                    <td>{row.tools}</td>
                    <td>{row.proof}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section id="contact" className="sheet contact">
          <h2>Have a system that must not lose money?</h2>
          <p className="section-lede">
            Email is the fastest way to reach me. I am based in Ho Chi Minh City.
          </p>
          <ul className="contact-links">
            <li>
              <a href={`mailto:${profile.email}`}>{profile.email}</a>
            </li>
            <li>
              <a href={profile.linkedin}>LinkedIn</a>
            </li>
          </ul>
        </section>
      </main>

      <footer className="foot">
        <p>
          {profile.name}, {profile.location}. Every number on this page is computed by code you can
          read in the source.
        </p>
      </footer>
    </>
  )
}
