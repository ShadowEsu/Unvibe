import { GALLERY, SHOT_CAPTION } from "@/data/homeGallery";
import { PixelIcon } from "./PixelIcon";

/**
 * "See what Vibe gives you." (Design's ledger 530 spec §5, static for now; the 530 motion lands on top): real
 * screenshots of the released app, each captioned as a real screen with sample code. Lazy images with their sizes
 * set, so nothing shifts and nothing competes with the hero's first paint.
 */
export function HomeGallery() {
  return (
    <section className="n-sec n-wrap ngal" id="see-it" aria-labelledby="see-it-title">
      <div className="n-head n-center">
        <h2 id="see-it-title">See what Vibe gives you.</h2>
      </div>
      <div className="ngal__grid">
        {GALLERY.map((card) => (
          <figure key={card.id} className={`ngal__card${card.shots.length > 1 ? " ngal__card--wide" : ""}`}>
            <div className="ngal__window">
              <div className="ngal__bar" aria-hidden="true"><i /><i /><i /></div>
              <div className="ngal__shots">
                {card.shots.map((shot) => (
                  <div key={shot.src} className="ngal__shot">
                    {shot.depth ? <p className="ngal__depth" aria-hidden="true">{shot.depth}</p> : null}
                    {/* eslint-disable-next-line @next/next/no-img-element -- fixed-size real captures, lazy below the fold */}
                    <img src={shot.src} width={shot.width} height={shot.height} alt={shot.alt} loading="lazy" decoding="async" />
                  </div>
                ))}
              </div>
            </div>
            <figcaption className="ngal__text">
              <h3>{card.title}</h3>
              <p>{card.line}</p>
              <span className="ngal__label">{SHOT_CAPTION}</span>
            </figcaption>
          </figure>
        ))}
        {/* Margin art beside the middle row's two cards, in the grid's empty first and last columns (spec §13.7). */}
        <PixelIcon name="09-notebook" className="ngal__px ngal__px--l" />
        <PixelIcon name="18-lightbulb" className="ngal__px ngal__px--r" />
      </div>
    </section>
  );
}
