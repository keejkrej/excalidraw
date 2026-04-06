import React from "react";

import { FilledButton } from "./FilledButton";
import { ArrowRightIcon, chevronLeftIcon, CloseIcon } from "./icons";

import "./PresentationControls.scss";

export const PresentationControls = ({
  currentSlideIndex,
  totalSlides,
  onPrevious,
  onNext,
  onClose,
}: {
  currentSlideIndex: number;
  totalSlides: number;
  onPrevious: () => void;
  onNext: () => void;
  onClose: () => void | Promise<void>;
}) => {
  return (
    <div className="PresentationControls">
      <div className="PresentationControls__inner">
        <FilledButton
          variant="icon"
          color="muted"
          icon={chevronLeftIcon}
          label="Previous slide"
          onClick={onPrevious}
          disabled={currentSlideIndex <= 0}
        />
        <div className="PresentationControls__counter">
          Slide {Math.max(currentSlideIndex + 1, 1)} / {Math.max(totalSlides, 1)}
        </div>
        <FilledButton
          variant="icon"
          color="muted"
          icon={ArrowRightIcon}
          label="Next slide"
          onClick={onNext}
          disabled={currentSlideIndex >= totalSlides - 1}
        />
        <FilledButton color="danger" icon={CloseIcon} label="End presentation" onClick={onClose}>
          End presentation
        </FilledButton>
      </div>
    </div>
  );
};
